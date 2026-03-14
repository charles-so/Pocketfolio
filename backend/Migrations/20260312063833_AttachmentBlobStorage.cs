using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pocketfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class AttachmentBlobStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Data",
                table: "Attachments");

            migrationBuilder.AddColumn<string>(
                name: "BlobName",
                table: "Attachments",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BlobName",
                table: "Attachments");

            migrationBuilder.AddColumn<byte[]>(
                name: "Data",
                table: "Attachments",
                type: "varbinary(max)",
                nullable: false,
                defaultValue: new byte[0]);
        }
    }
}
