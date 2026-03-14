using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace Pocketfolio.Api.Services;

public class BlobStorageService
{
    private readonly BlobContainerClient _container;

    public BlobStorageService(IConfiguration config)
    {
        var connectionString = config["BlobStorage:ConnectionString"]!;
        var containerName = config["BlobStorage:ContainerName"] ?? "attachments";
        var client = new BlobServiceClient(connectionString);
        _container = client.GetBlobContainerClient(containerName);
        _container.CreateIfNotExists(PublicAccessType.None);
    }

    public async Task<string> UploadAsync(int userId, string fileName, string contentType, Stream content)
    {
        // Blob path: {userId}/{guid}-{fileName}
        var blobName = $"{userId}/{Guid.NewGuid()}-{fileName}";
        var blob = _container.GetBlobClient(blobName);

        var headers = new BlobHttpHeaders { ContentType = contentType };
        await blob.UploadAsync(content, new BlobUploadOptions { HttpHeaders = headers });

        return blobName;
    }

    public async Task<(Stream Content, string ContentType, string FileName)> DownloadAsync(string blobName)
    {
        var blob = _container.GetBlobClient(blobName);
        var response = await blob.DownloadStreamingAsync();
        var contentType = response.Value.Details.ContentType;
        var fileName = Path.GetFileName(blobName);
        // Strip the guid prefix: {guid}-{originalFileName}
        var dashIndex = fileName.IndexOf('-');
        if (dashIndex > 0) fileName = fileName[(dashIndex + 1)..];
        return (response.Value.Content, contentType, fileName);
    }

    public async Task DeleteAsync(string blobName)
    {
        var blob = _container.GetBlobClient(blobName);
        await blob.DeleteIfExistsAsync();
    }
}
