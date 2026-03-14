using System.Security.Claims;
using Pocketfolio.Api.Data;

namespace Pocketfolio.Api.Middleware;

public class UserDatabaseMiddleware
{
    private readonly RequestDelegate _next;

    public UserDatabaseMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var userIdClaim = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (int.TryParse(userIdClaim, out var userId))
        {
            var db = context.RequestServices.GetRequiredService<AppDbContext>();
            db.UserId = userId;
        }

        await _next(context);
    }
}
