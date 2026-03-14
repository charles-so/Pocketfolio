namespace Pocketfolio.Api.Dtos;

public record RegisterRequest(string Username, string Password);
public record LoginRequest(string Username, string Password);
public record AuthResponse(string Token, string Username, bool IsAdmin);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record MasterResetPasswordRequest(string MasterKey, string Username, string NewPassword);
