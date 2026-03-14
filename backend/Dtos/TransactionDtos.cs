namespace Pocketfolio.Api.Dtos;

public record CreateTransactionRequest(string Date, int EnvelopeId, decimal Amount, string? Description);

public record UpdateTransactionRequest(string Date, int EnvelopeId, decimal Amount, string? Description);

public record TransactionDto
{
    public int Id { get; set; }
    public int EnvelopeId { get; set; }
    public decimal Amount { get; set; }
    public string Date { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string EnvelopeName { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string RowType { get; set; } = "txn";
    // Bonus-specific fields
    public int? Period { get; set; }
    public string? PeriodLabel { get; set; }
    public int AttachmentCount { get; set; }
    public string? AttachmentName { get; set; }
    public string? Status { get; set; } // "committed" or "pending"
}
