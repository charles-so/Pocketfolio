using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;

namespace Pocketfolio.Api.Tests.Helpers;

public static class TestDbContextFactory
{
    public static AppDbContext Create(int userId = 1)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var db = new AppDbContext(options) { UserId = userId };
        db.Database.EnsureCreated();
        return db;
    }
}
