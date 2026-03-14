namespace Pocketfolio.Api.Dtos;

public record PortfolioResponse(
    List<HoldingDto> Holdings,
    decimal TotalValue,
    decimal TotalCost,
    decimal TotalDividendsYtd,
    decimal DailyChange,
    decimal DailyChangePct);

public class HoldingDto
{
    public int Id { get; set; }
    public string Ticker { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Shares { get; set; }
    public decimal CostBasis { get; set; }
    public decimal Price { get; set; }
    public decimal PreviousClose { get; set; }
    public decimal DailyChange { get; set; }
    public decimal DailyChangePct { get; set; }
}

public record CreateHoldingRequest(string Ticker, string? Name, decimal Shares, decimal CostBasis);

public record UpdateHoldingRequest(string? Ticker, string? Name, decimal? Shares, decimal? CostBasis);

public record PortfolioHistoryResponse(List<HistoryPointDto> History);

public record HistoryPointDto(string Date, decimal Value);

public record SellHoldingRequest(int HoldingId, decimal Shares, decimal Price, decimal Fees);

public record SellHoldingResponse(bool Ok, decimal Proceeds, decimal Gain);
