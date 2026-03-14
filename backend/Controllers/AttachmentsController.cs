using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
public class AttachmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BlobStorageService _blob;
    private const long MaxFileSize = 10 * 1024 * 1024; // 10MB

    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv",
    };

    private static readonly HashSet<string> ValidEntityTypes = new() { "txn", "income", "bonus" };
    private static readonly HashSet<string> InlineTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
        "application/pdf", "text/plain", "text/csv",
    };

    public AttachmentsController(AppDbContext db, BlobStorageService blob)
    {
        _db = db;
        _blob = blob;
    }

    [HttpGet("api/attachments")]
    public async Task<IActionResult> List([FromQuery] string entityType, [FromQuery] int entityId)
    {
        if (!ValidEntityTypes.Contains(entityType))
            return BadRequest(new { error = "Invalid entity type." });

        var attachments = await _db.Attachments
            .Where(a => a.EntityType == entityType && a.EntityId == entityId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new { a.Id, a.FileName, a.ContentType, a.Size })
            .ToListAsync();

        return Ok(new { attachments });
    }

    [HttpGet("api/transactions/{transactionId}/attachments")]
    public async Task<IActionResult> ListByTransaction(int transactionId)
    {
        var attachments = await _db.Attachments
            .Where(a => a.EntityType == "txn" && a.EntityId == transactionId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new { a.Id, a.FileName, a.ContentType, a.Size })
            .ToListAsync();

        return Ok(new { attachments });
    }

    [HttpPost("api/attachments/upload")]
    [RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<IActionResult> Upload([FromQuery] string entityType, [FromQuery] int entityId, IFormFile file)
    {
        if (!ValidEntityTypes.Contains(entityType))
            return BadRequest(new { error = "Invalid entity type." });

        bool exists = entityType switch
        {
            "txn" => await _db.Transactions.AnyAsync(t => t.Id == entityId),
            "income" => await _db.Incomes.AnyAsync(i => i.Id == entityId),
            "bonus" => await _db.BonusAllocations.AnyAsync(b => b.Id == entityId),
            _ => false,
        };
        if (!exists) return NotFound(new { error = "Record not found." });

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        if (file.Length > MaxFileSize)
            return BadRequest(new { error = "File too large. Max 10MB." });

        if (!AllowedTypes.Contains(file.ContentType))
            return BadRequest(new { error = $"File type '{file.ContentType}' not allowed." });

        using var stream = file.OpenReadStream();
        var blobName = await _blob.UploadAsync(_db.UserId, Path.GetFileName(file.FileName), file.ContentType, stream);

        var attachment = new Attachment
        {
            EntityType = entityType,
            EntityId = entityId,
            TransactionId = entityType == "txn" ? entityId : null,
            FileName = Path.GetFileName(file.FileName),
            ContentType = file.ContentType,
            BlobName = blobName,
            Size = file.Length,
        };

        _db.Attachments.Add(attachment);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true, id = attachment.Id });
    }

    [HttpPost("api/transactions/{transactionId}/attachments")]
    [RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<IActionResult> UploadByTransaction(int transactionId, IFormFile file)
    {
        var txn = await _db.Transactions.FindAsync(transactionId);
        if (txn == null) return NotFound(new { error = "Transaction not found." });

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        if (file.Length > MaxFileSize)
            return BadRequest(new { error = "File too large. Max 10MB." });

        if (!AllowedTypes.Contains(file.ContentType))
            return BadRequest(new { error = $"File type '{file.ContentType}' not allowed." });

        using var stream = file.OpenReadStream();
        var blobName = await _blob.UploadAsync(_db.UserId, Path.GetFileName(file.FileName), file.ContentType, stream);

        var attachment = new Attachment
        {
            EntityType = "txn",
            EntityId = transactionId,
            TransactionId = transactionId,
            FileName = Path.GetFileName(file.FileName),
            ContentType = file.ContentType,
            BlobName = blobName,
            Size = file.Length,
        };

        _db.Attachments.Add(attachment);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true, id = attachment.Id });
    }

    [HttpGet("api/attachments/{id}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var attachment = await _db.Attachments.FindAsync(id);
        if (attachment == null) return NotFound(new { error = "Attachment not found." });

        var (content, contentType, fileName) = await _blob.DownloadAsync(attachment.BlobName);
        if (InlineTypes.Contains(contentType))
        {
            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{attachment.FileName}\"");
            return File(content, contentType);
        }
        return File(content, contentType, attachment.FileName);
    }

    [HttpGet("api/attachments/{id}")]
    public async Task<IActionResult> DownloadLegacy(int id)
    {
        var attachment = await _db.Attachments.FindAsync(id);
        if (attachment == null) return NotFound(new { error = "Attachment not found." });

        var (content, contentType, fileName) = await _blob.DownloadAsync(attachment.BlobName);
        if (InlineTypes.Contains(contentType))
        {
            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{attachment.FileName}\"");
            return File(content, contentType);
        }
        return File(content, contentType, attachment.FileName);
    }

    [HttpDelete("api/attachments/{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var attachment = await _db.Attachments.FindAsync(id);
        if (attachment == null) return NotFound(new { error = "Attachment not found." });

        await _blob.DeleteAsync(attachment.BlobName);
        _db.Attachments.Remove(attachment);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }
}
