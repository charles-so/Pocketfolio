namespace Pocketfolio.Api.Dtos;

public record WatchlistResponse(List<WatchlistTickerDto> Tickers);

public class WatchlistTickerDto
{
    public string Ticker { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal PreviousClose { get; set; }
    public decimal DailyChange { get; set; }
    public decimal DailyChangePct { get; set; }
    public bool IsHolding { get; set; }
    public int? WatchlistItemId { get; set; }
}

public record AddWatchlistItemRequest(string Ticker, string? Name);

public record TickerDetailsResponse(TickerDetailsDto Details);

public class TickerDetailsDto
{
    public decimal WeekChangePct { get; set; }
    public decimal MonthChangePct { get; set; }
    public decimal YtdChangePct { get; set; }
    public decimal YearChangePct { get; set; }
    public decimal? DividendYield { get; set; }
    public decimal? TrailingPE { get; set; }
    public decimal? MarketCap { get; set; }
    public decimal? FiftyTwoWeekHigh { get; set; }
    public decimal? FiftyTwoWeekLow { get; set; }
    public decimal? Beta { get; set; }
    public string Currency { get; set; } = "AUD";
    public string Exchange { get; set; } = string.Empty;
}
