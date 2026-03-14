namespace Pocketfolio.Api.Dtos;

public record CreateBonusRequest(int EnvelopeId, decimal Amount, int Period, string? Description);

public record UpdateBonusRequest(decimal Amount, string? Description);
