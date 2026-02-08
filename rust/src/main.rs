mod cli_exec;
mod config;
mod file_check;
mod git_diff;
mod logger;
mod models;
mod prompt;
mod server;
mod system_prompt;

use clap::{Parser, Subcommand};
use rmcp::ServiceExt;

use config::{config_dir, load_config};
use logger::log_server_start;
use server::{SecondOpinionServer, SERVER_VERSION};
use system_prompt::init_system_prompt;

#[derive(Parser)]
#[command(name = "grey-rso", version = SERVER_VERSION, about = "Second Opinion MCP server")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Create default system prompt file
    InitPrompt,
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::InitPrompt) => {
            let dir = config_dir();
            match init_system_prompt(&dir) {
                Ok(path) => {
                    println!("Created system prompt at: {}", path.display());
                    println!("You can now edit this file to customize the system prompt.");
                }
                Err(e) => {
                    eprintln!("{e}");
                    std::process::exit(1);
                }
            }
        }
        None => {
            // Default: run MCP server on stdio
            let config = load_config();
            log_server_start(SERVER_VERSION);

            let service = SecondOpinionServer::new(config);
            let server = service
                .serve(rmcp::transport::io::stdio())
                .await
                .expect("failed to start MCP server");
            server.waiting().await?;
        }
    }

    Ok(())
}
