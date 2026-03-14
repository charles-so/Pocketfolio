using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
public class WatchlistController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly YahooFinanceService _yahoo;

    public WatchlistController(AppDbContext db, YahooFinanceService yahoo)
    {
        _db = db;
        _yahoo = yahoo;
    }

    [HttpGet("api/watchlist")]
    public async Task<IActionResult> Get([FromQuery] string? refresh)
    {
        var force = refresh == "1";

        // Build a set of holding tickers for isHolding flag
        var holdingTickers = new HashSet<string>(
            await _db.PortfolioHoldings.Select(h => h.Ticker).ToListAsync(),
            StringComparer.OrdinalIgnoreCase);

        // Watchlist is driven entirely by WatchlistItems
        var watchlistItems = await _db.WatchlistItems
            .OrderBy(w => w.Ticker)
            .ToListAsync();

        var tickers = new List<WatchlistTickerDto>();

        foreach (var w in watchlistItems)
        {
            var quote = await _yahoo.GetQuoteAsync(w.Ticker, force);
            var price = quote.Price;
            var prevClose = quote.PreviousClose;
            var dailyChange = price - prevClose;
            var dailyChangePct = prevClose != 0 ? (dailyChange / prevClose) * 100 : 0;

            tickers.Add(new WatchlistTickerDto
            {
                Ticker = w.Ticker,
                Name = !string.IsNullOrEmpty(w.Name) ? w.Name : quote.Name,
                Price = Math.Round(price, 2),
                PreviousClose = Math.Round(prevClose, 2),
                DailyChange = Math.Round(dailyChange, 2),
                DailyChangePct = Math.Round(dailyChangePct, 2),
                IsHolding = holdingTickers.Contains(w.Ticker),
                WatchlistItemId = w.Id,
            });
        }

        return Ok(new WatchlistResponse(tickers));
    }

    [HttpGet("api/watchlist/history/{ticker}")]
    public async Task<IActionResult> History(string ticker, [FromQuery] string period = "6mo")
    {
        var hist = await _yahoo.GetHistoryAsync(ticker, period);
        var points = hist.Select(h => new HistoryPointDto(h.Date, h.Close)).ToList();
        return Ok(new PortfolioHistoryResponse(points));
    }

    [HttpGet("api/watchlist/details/{ticker}")]
    public async Task<IActionResult> Details(string ticker)
    {
        var data = await _yahoo.GetTickerDetailsAsync(ticker);

        var dto = new TickerDetailsDto
        {
            WeekChangePct = data.WeekChangePct,
            MonthChangePct = data.MonthChangePct,
            YtdChangePct = data.YtdChangePct,
            YearChangePct = data.YearChangePct,
            DividendYield = data.DividendYield,
            TrailingPE = data.TrailingPE,
            MarketCap = data.MarketCap,
            FiftyTwoWeekHigh = data.FiftyTwoWeekHigh,
            FiftyTwoWeekLow = data.FiftyTwoWeekLow,
            Beta = data.Beta,
            Currency = data.Currency,
            Exchange = data.Exchange,
        };

        return Ok(new TickerDetailsResponse(dto));
    }

    [HttpPost("api/watchlist")]
    public async Task<IActionResult> Add([FromBody] AddWatchlistItemRequest req)
    {
        var ticker = req.Ticker?.Trim().ToUpper() ?? "";
        if (string.IsNullOrEmpty(ticker))
            return BadRequest(new { error = "Ticker is required." });

        // Check if already in watchlist
        var inWatchlist = await _db.WatchlistItems
            .AnyAsync(w => w.Ticker.ToUpper() == ticker);
        if (inWatchlist)
            return BadRequest(new { error = "This ticker is already in your watchlist." });

        var item = new WatchlistItem
        {
            Ticker = ticker,
            Name = req.Name?.Trim() ?? "",
        };

        _db.WatchlistItems.Add(item);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true, id = item.Id });
    }

    [HttpDelete("api/watchlist/{id}")]
    public async Task<IActionResult> Remove(int id)
    {
        var item = await _db.WatchlistItems.FindAsync(id);
        if (item == null)
            return NotFound(new { error = "Watchlist item not found." });

        _db.WatchlistItems.Remove(item);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }
}
