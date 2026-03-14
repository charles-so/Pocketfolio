using Microsoft.AspNetCore.Mvc;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
public class TickersController : ControllerBase
{
    private readonly YahooFinanceService _yahooService;


    public TickersController(YahooFinanceService yahooService)
    {
        _yahooService = yahooService;
    }

    [HttpGet("api/tickers/search")]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        if (string.IsNullOrEmpty(q) || q.Length < 2)
            return Ok(new { results = Array.Empty<object>() });

        // Search via Yahoo Finance live
        var results = await _yahooService.SearchAsync(q, 20);

        return Ok(new { results });
    }


    [HttpGet("api/price/{ticker}")]
    public async Task<IActionResult> Price(string ticker)
    {
        var quote = await _yahooService.GetQuoteAsync(ticker);
        return Ok(new { ticker, price = quote.Price, currency = quote.Currency });
    }
}
