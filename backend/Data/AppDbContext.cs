using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Entities;

namespace Pocketfolio.Api.Data;

public class AppDbContext : DbContext
{
    public int UserId { get; set; }

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Envelope> Envelopes => Set<Envelope>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<BudgetChange> BudgetChanges => Set<BudgetChange>();
    public DbSet<BonusAllocation> BonusAllocations => Set<BonusAllocation>();
    public DbSet<PortfolioHolding> PortfolioHoldings => Set<PortfolioHolding>();
    public DbSet<Trade> Trades => Set<Trade>();
    public DbSet<TickerEntry> TickerDirectory => Set<TickerEntry>();
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<WatchlistItem> WatchlistItems => Set<WatchlistItem>();
    public DbSet<Income> Incomes => Set<Income>();
    public DbSet<RecurringItem> RecurringItems => Set<RecurringItem>();
    public DbSet<Attachment> Attachments => Set<Attachment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // User (not tenant-scoped)
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Username).IsUnique();
            e.Property(u => u.Username).HasMaxLength(64).IsRequired();
            e.Property(u => u.PasswordHash).IsRequired();
        });

        // Envelope
        modelBuilder.Entity<Envelope>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.Name }).IsUnique();
            e.HasIndex(x => x.UserId);
            e.Property(x => x.BudgetFn).HasColumnType("decimal(18,2)");
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // Transaction
        modelBuilder.Entity<Transaction>(e =>
        {
            e.HasIndex(x => x.EnvelopeId);
            e.HasIndex(x => x.Date);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.RecurringItemId);
            e.Property(x => x.Amount).HasColumnType("decimal(18,2)");
            e.HasOne(x => x.Envelope).WithMany(x => x.Transactions).HasForeignKey(x => x.EnvelopeId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.RecurringItem).WithMany().HasForeignKey(x => x.RecurringItemId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // BudgetChange
        modelBuilder.Entity<BudgetChange>(e =>
        {
            e.HasIndex(x => x.UserId);
            e.Property(x => x.BudgetFn).HasColumnType("decimal(18,2)");
            e.HasOne(x => x.Envelope).WithMany(x => x.BudgetChanges).HasForeignKey(x => x.EnvelopeId).OnDelete(DeleteBehavior.Cascade);
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // BonusAllocation
        modelBuilder.Entity<BonusAllocation>(e =>
        {
            e.HasIndex(x => x.UserId);
            e.Property(x => x.Amount).HasColumnType("decimal(18,2)");
            e.HasOne(x => x.Envelope).WithMany(x => x.BonusAllocations).HasForeignKey(x => x.EnvelopeId).OnDelete(DeleteBehavior.Cascade);
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // PortfolioHolding
        modelBuilder.Entity<PortfolioHolding>(e =>
        {
            e.HasIndex(x => x.UserId);
            e.Property(x => x.Shares).HasColumnType("decimal(18,6)");
            e.Property(x => x.CostBasis).HasColumnType("decimal(18,2)");
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // Trade
        modelBuilder.Entity<Trade>(e =>
        {
            e.HasIndex(x => x.UserId);
            e.Property(x => x.Shares).HasColumnType("decimal(18,6)");
            e.Property(x => x.Price).HasColumnType("decimal(18,4)");
            e.Property(x => x.Fees).HasColumnType("decimal(18,2)");
            e.Property(x => x.TotalCost).HasColumnType("decimal(18,2)");
            e.HasOne(x => x.Envelope).WithMany(x => x.Trades).HasForeignKey(x => x.EnvelopeId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Holding).WithMany(x => x.Trades).HasForeignKey(x => x.HoldingId).OnDelete(DeleteBehavior.NoAction);
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // TickerEntry
        modelBuilder.Entity<TickerEntry>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.Ticker }).IsUnique();
            e.HasIndex(x => x.Name);
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // Setting
        modelBuilder.Entity<Setting>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.Key }).IsUnique();
            e.Property(x => x.Key).HasMaxLength(100);
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // WatchlistItem
        modelBuilder.Entity<WatchlistItem>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.Ticker }).IsUnique();
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // Income
        modelBuilder.Entity<Income>(e =>
        {
            e.HasIndex(x => x.Date);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.RecurringItemId);
            e.Property(x => x.Amount).HasColumnType("decimal(18,2)");
            e.Property(x => x.Type).HasMaxLength(20);
            e.HasOne(x => x.RecurringItem).WithMany().HasForeignKey(x => x.RecurringItemId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // RecurringItem
        modelBuilder.Entity<RecurringItem>(e =>
        {
            e.HasIndex(x => x.UserId);
            e.Property(x => x.Amount).HasColumnType("decimal(18,2)");
            e.Property(x => x.Type).HasMaxLength(20);
            e.Property(x => x.IncomeType).HasMaxLength(20);
            e.Property(x => x.Frequency).HasMaxLength(20);
            e.HasOne(x => x.Envelope).WithMany().HasForeignKey(x => x.EnvelopeId).OnDelete(DeleteBehavior.SetNull);
            e.HasQueryFilter(x => x.UserId == UserId);
        });

        // Attachment
        modelBuilder.Entity<Attachment>(e =>
        {
            e.HasIndex(x => new { x.EntityType, x.EntityId });
            e.HasIndex(x => x.TransactionId);
            e.HasIndex(x => x.UserId);
            e.HasOne(x => x.Transaction).WithMany(x => x.Attachments).HasForeignKey(x => x.TransactionId).IsRequired(false).OnDelete(DeleteBehavior.Cascade);
            e.HasQueryFilter(x => x.UserId == UserId);
        });
    }

    public override int SaveChanges()
    {
        StampUserId();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampUserId();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void StampUserId()
    {
        foreach (var entry in ChangeTracker.Entries<ITenantEntity>())
        {
            if (entry.State == EntityState.Added && entry.Entity.UserId == 0)
                entry.Entity.UserId = UserId;
        }
    }
}
