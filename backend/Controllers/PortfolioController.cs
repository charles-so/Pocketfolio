using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
public class PortfolioController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly YahooFinanceService _yahoo;
    private readonly BudgetEngine _engine;

    public PortfolioController(AppDbContext db, YahooFinanceService yahoo, BudgetEngine engine)
    {
        _db = db;
        _yahoo = yahoo;
        _engine = engine;
    }

    [HttpGet("api/portfolio")]
    public async Task<IActionResult> Get([FromQuery] string? refresh)
    {
        var force = refresh == "1";
        var holdings = await _db.PortfolioHoldings.OrderBy(h => h.Ticker).ToListAsync();

        decimal totalValue = 0, totalCost = 0, totalDivYtd = 0, totalPrevValue = 0;
        var holdingDtos = new List<HoldingDto>();

        foreach (var h in holdings)
        {
            var quote = await _yahoo.GetQuoteAsync(h.Ticker, force);
            var price = quote.Price;
            var prevClose = quote.PreviousClose;
            if (string.IsNullOrEmpty(h.Name)) h.Name = quote.Name;

            var mktVal = h.Shares * price;
            var prevVal = h.Shares * prevClose;
            var holdingDailyChange = mktVal - prevVal;
            var holdingDailyChangePct = prevVal != 0 ? (holdingDailyChange / prevVal) * 100 : 0;

            totalValue += mktVal;
            totalPrevValue += prevVal;
            totalCost += h.CostBasis;
            totalDivYtd += quote.YtdDivPerShare * h.Shares;

            holdingDtos.Add(new HoldingDto
            {
                Id = h.Id,
                Ticker = h.Ticker,
                Name = h.Name,
                Shares = h.Shares,
                CostBasis = h.CostBasis,
                Price = price,
                PreviousClose = prevClose,
                DailyChange = Math.Round(holdingDailyChange, 2),
                DailyChangePct = Math.Round(holdingDailyChangePct, 2),
            });
        }

        await _db.SaveChangesAsync(); // Save any name updates

        var dailyChange = totalValue - totalPrevValue;
        var dailyChangePct = totalPrevValue != 0 ? (dailyChange / totalPrevValue) * 100 : 0;

        return Ok(new PortfolioResponse(
            holdingDtos,
            Math.Round(totalValue, 2),
            Math.Round(totalCost, 2),
            Math.Round(totalDivYtd, 2),
            Math.Round(dailyChange, 2),
            Math.Round(dailyChangePct, 2)));
    }

    [HttpGet("api/portfolio/history")]
    public async Task<IActionResult> History([FromQuery] string period = "6mo")
    {
        var holdings = await _db.PortfolioHoldings.ToListAsync();
        var valueByDate = new Dictionary<string, decimal>();

        foreach (var h in holdings)
        {
            if (h.Shares <= 0) continue;

            // Get all trades for this holding, ordered by date
            var trades = await _db.Trades
                .Where(t => t.HoldingId == h.Id)
                .OrderBy(t => t.Date)
                .Select(t => new { t.Date, t.Shares })
                .ToListAsync();

            var hist = await _yahoo.GetHistoryAsync(h.Ticker, period);

            foreach (var point in hist)
            {
                var pointDate = DateTime.Parse(point.Date);

                // Calculate shares held on this date by summing trades up to this date
                decimal sharesOnDate = 0;
                foreach (var trade in trades)
                {
                    if (trade.Date <= pointDate)
                        sharesOnDate += trade.Shares;
                }

                if (sharesOnDate <= 0) continue;

                if (!valueByDate.ContainsKey(point.Date))
                    valueByDate[point.Date] = 0;
                valueByDate[point.Date] += point.Close * sharesOnDate;
            }
        }

        var history = valueByDate
            .OrderBy(kv => kv.Key)
            .Select(kv => new HistoryPointDto(kv.Key, Math.Round(kv.Value, 2)))
            .ToList();

        return Ok(new PortfolioHistoryResponse(history));
    }

    [HttpPost("api/portfolio/holdings")]
    public async Task<IActionResult> CreateHolding([FromBody] CreateHoldingRequest req)
    {
        var ticker = req.Ticker?.Trim().ToUpper() ?? "";
        if (string.IsNullOrEmpty(ticker))
            return BadRequest(new { error = "Ticker is required." });
        if (req.Shares < 0)
            return BadRequest(new { error = "Shares must be a non-negative number." });
        if (req.CostBasis < 0)
            return BadRequest(new { error = "Cost basis must be a non-negative number." });

        var holding = new PortfolioHolding
        {
            Ticker = ticker,
            Name = req.Name?.Trim() ?? "",
            Shares = req.Shares,
            CostBasis = req.CostBasis,
        };
        _db.PortfolioHoldings.Add(holding);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true, id = holding.Id });
    }

    [HttpPut("api/portfolio/holdings/{id}")]
    public async Task<IActionResult> UpdateHolding(int id, [FromBody] UpdateHoldingRequest req)
    {
        var holding = await _db.PortfolioHoldings.FindAsync(id);
        if (holding == null) return NotFound(new { error = "Holding not found." });

        if (req.Ticker != null)
            holding.Ticker = req.Ticker.Trim().ToUpper();
        if (req.Name != null)
            holding.Name = req.Name.Trim();
        if (req.Shares.HasValue)
        {
            if (req.Shares.Value < 0) return BadRequest(new { error = "Shares must be a non-negative number." });
            holding.Shares = req.Shares.Value;
        }
        if (req.CostBasis.HasValue)
        {
            if (req.CostBasis.Value < 0) return BadRequest(new { error = "Cost basis must be a non-negative number." });
            holding.CostBasis = req.CostBasis.Value;
        }

        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPost("api/portfolio/sell")]
    public async Task<IActionResult> Sell([FromBody] SellHoldingRequest req)
    {
        var holding = await _db.PortfolioHoldings.FindAsync(req.HoldingId);
        if (holding == null)
            return NotFound(new { error = "Holding not found." });
        if (req.Shares <= 0)
            return BadRequest(new { error = "Shares must be positive." });
        if (req.Shares > holding.Shares)
            return BadRequest(new { error = "Cannot sell more shares than you hold." });
        if (req.Price <= 0)
            return BadRequest(new { error = "Price must be positive." });

        // Weighted average cost
        var avgCostPerShare = holding.Shares > 0 ? holding.CostBasis / holding.Shares : 0;
        var costAllocated = avgCostPerShare * req.Shares;
        var proceeds = (req.Shares * req.Price) - req.Fees;
        var gain = proceeds - costAllocated;

        // Update holding
        holding.Shares -= req.Shares;
        holding.CostBasis -= costAllocated;
        if (holding.Shares <= 0)
        {
            // Remove related trades first (FK constraint)
            await _db.Trades.Where(t => t.HoldingId == holding.Id).ExecuteDeleteAsync();
            _db.PortfolioHoldings.Remove(holding);
        }

        var ticker = holding.Ticker;
        var gainDesc = gain >= 0 ? $"gain ${gain:F2}" : $"loss ${Math.Abs(gain):F2}";

        // Record sale proceeds as income
        _db.Incomes.Add(new Income
        {
            Amount = Math.Round(proceeds, 2),
            Date = DateTime.Today,
            Type = "StockSale",
            Description = $"Sold {req.Shares} {ticker} @ ${req.Price:F2} ({gainDesc})",
        });

        await _db.SaveChangesAsync();

        return Ok(new SellHoldingResponse(true, Math.Round(proceeds, 2), Math.Round(gain, 2)));
    }

    [HttpDelete("api/portfolio/holdings/{id}")]
    public async Task<IActionResult> DeleteHolding(int id)
    {
        var holding = await _db.PortfolioHoldings.FindAsync(id);
        if (holding == null) return NotFound(new { error = "Holding not found." });

        _db.PortfolioHoldings.Remove(holding);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }
}
