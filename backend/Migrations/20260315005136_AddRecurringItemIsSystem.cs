using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pocketfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurringItemIsSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSystem",
                table: "RecurringItems",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSystem",
                table: "RecurringItems");
        }
    }
}
