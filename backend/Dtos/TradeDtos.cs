namespace Pocketfolio.Api.Dtos;

public record CreateTradeRequest(int EnvelopeId, string Date, decimal Shares, decimal Price, decimal Fees);

public record UpdateTradeRequest(string Date, decimal Shares, decimal Price, decimal Fees);

public record TradeDto
{
    public int Id { get; set; }
    public int EnvelopeId { get; set; }
    public int HoldingId { get; set; }
    public string Date { get; set; } = string.Empty;
    public decimal Shares { get; set; }
    public decimal Price { get; set; }
    public decimal Fees { get; set; }
    public decimal TotalCost { get; set; }
    public string EnvelopeName { get; set; } = string.Empty;
    public string Ticker { get; set; } = string.Empty;
}

public record InvestmentSummaryDto(int EnvelopeId, string Ticker, string EnvelopeName, decimal Deposited, decimal Traded, decimal Cash);
