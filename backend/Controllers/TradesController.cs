using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
public class TradesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BudgetEngine _engine;

    public TradesController(AppDbContext db, BudgetEngine engine)
    {
        _db = db;
        _engine = engine;
    }

    [HttpPost("api/trade")]
    public async Task<IActionResult> Create([FromBody] CreateTradeRequest req)
    {
        var env = await _db.Envelopes.FindAsync(req.EnvelopeId);
        if (env == null) return BadRequest(new { error = "Envelope not found." });
        if (env.GroupName != "Investments")
            return BadRequest(new { error = "Only Investment envelopes can record trades." });
        if (string.IsNullOrEmpty(env.Ticker))
            return BadRequest(new { error = "Envelope has no ticker assigned." });

        if (!DateTime.TryParse(req.Date, out var tradeDate))
            return BadRequest(new { error = "Invalid date. Use YYYY-MM-DD." });
        if (req.Shares <= 0)
            return BadRequest(new { error = "Shares must be a positive number." });
        if (req.Price <= 0)
            return BadRequest(new { error = "Price must be a positive number." });
        if (req.Fees < 0)
            return BadRequest(new { error = "Fees must be non-negative." });

        var totalCost = Math.Round(req.Shares * req.Price + req.Fees, 2);

        var cash = _engine.GetInvestmentCash(req.EnvelopeId);
        if (totalCost > cash)
            return BadRequest(new { error = $"Insufficient cash to invest. Cash: ${cash:F2}, Trade cost: ${totalCost:F2}" });

        var holding = await _db.PortfolioHoldings.FirstOrDefaultAsync(h => h.Ticker == env.Ticker);
        if (holding == null)
        {
            holding = new PortfolioHolding
            {
                Ticker = env.Ticker!,
                Name = env.Name,
                Shares = 0,
                CostBasis = 0,
            };
            _db.PortfolioHoldings.Add(holding);
            await _db.SaveChangesAsync(); // Save to get the Id for the trade FK
        }

        // Atomic: insert trade + update holding
        _db.Trades.Add(new Trade
        {
            EnvelopeId = req.EnvelopeId,
            HoldingId = holding.Id,
            Date = tradeDate,
            Shares = req.Shares,
            Price = req.Price,
            Fees = req.Fees,
            TotalCost = totalCost,
        });

        holding.Shares += req.Shares;
        holding.CostBasis = Math.Round(holding.CostBasis + (req.Shares * req.Price), 2);

        // Auto-add to watchlist if not already there
        var ticker = env.Ticker!.ToUpper();
        var inWatchlist = await _db.WatchlistItems.AnyAsync(w => w.Ticker.ToUpper() == ticker);
        if (!inWatchlist)
        {
            _db.WatchlistItems.Add(new WatchlistItem
            {
                Ticker = ticker,
                Name = holding.Name,
            });
        }

        await _db.SaveChangesAsync();

        return Ok(new { ok = true, totalCost });
    }

    [HttpGet("api/trades")]
    public async Task<IActionResult> GetAll([FromQuery] int limit = 50, [FromQuery] string? ticker = null)
    {
        var tradesQuery = _db.Trades
            .Include(t => t.Envelope)
            .Include(t => t.Holding)
            .AsQueryable();
        if (!string.IsNullOrEmpty(ticker))
            tradesQuery = tradesQuery.Where(t => t.Holding.Ticker == ticker);
        var trades = await tradesQuery
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.Id)
            .Take(limit)
            .Select(t => new TradeDto
            {
                Id = t.Id,
                EnvelopeId = t.EnvelopeId,
                HoldingId = t.HoldingId,
                Date = t.Date.ToString("yyyy-MM-dd"),
                Shares = t.Shares,
                Price = t.Price,
                Fees = t.Fees,
                TotalCost = t.TotalCost,
                EnvelopeName = t.Envelope.Name,
                Ticker = t.Holding.Ticker,
            })
            .ToListAsync();

        var investmentSummary = await GetInvestmentSummary();

        return Ok(new { trades, investmentSummary });
    }

    [HttpPut("api/trades/{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTradeRequest req)
    {
        if (!DateTime.TryParse(req.Date, out var tradeDate))
            return BadRequest(new { error = "Invalid date. Use YYYY-MM-DD." });
        if (req.Shares <= 0)
            return BadRequest(new { error = "Shares must be a positive number." });
        if (req.Price <= 0)
            return BadRequest(new { error = "Price must be a positive number." });
        if (req.Fees < 0)
            return BadRequest(new { error = "Fees must be non-negative." });

        var old = await _db.Trades.FindAsync(id);
        if (old == null) return NotFound(new { error = "Trade not found." });

        var holding = await _db.PortfolioHoldings.FindAsync(old.HoldingId);
        if (holding != null)
        {
            // Reverse old
            holding.Shares -= old.Shares;
            holding.CostBasis -= old.Shares * old.Price;
            // Apply new
            holding.Shares += req.Shares;
            holding.CostBasis += req.Shares * req.Price;
            holding.Shares = Math.Round(holding.Shares, 6);
            holding.CostBasis = Math.Round(holding.CostBasis, 2);
        }

        old.Date = tradeDate;
        old.Shares = req.Shares;
        old.Price = req.Price;
        old.Fees = req.Fees;
        old.TotalCost = Math.Round(req.Shares * req.Price + req.Fees, 2);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    [HttpDelete("api/trades/{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var trade = await _db.Trades.FindAsync(id);
        if (trade == null) return NotFound(new { error = "Trade not found." });

        var holding = await _db.PortfolioHoldings.FindAsync(trade.HoldingId);
        if (holding != null)
        {
            holding.Shares = Math.Max(0, holding.Shares - trade.Shares);
            holding.CostBasis = Math.Max(0, Math.Round(holding.CostBasis - (trade.Shares * trade.Price), 2));
        }

        _db.Trades.Remove(trade);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    private async Task<List<InvestmentSummaryDto>> GetInvestmentSummary()
    {
        var investmentEnvs = await _db.Envelopes
            .Where(e => e.GroupName == "Investments" && e.Ticker != null)
            .ToListAsync();

        var summary = new List<InvestmentSummaryDto>();
        foreach (var env in investmentEnvs)
        {
            var deposited = await _db.Transactions
                .Where(t => t.EnvelopeId == env.Id)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var traded = await _db.Trades
                .Where(t => t.EnvelopeId == env.Id)
                .SumAsync(t => (decimal?)t.TotalCost) ?? 0m;

            summary.Add(new InvestmentSummaryDto(
                env.Id,
                env.Ticker!, env.Name,
                Math.Round(deposited, 2),
                Math.Round(traded, 2),
                Math.Round(deposited - traded, 2)));
        }
        return summary;
    }
}
