import * as vscode from "vscode";
import { AuthService } from "../services/auth";

/**
 * Sign in command handler.
 * Initiates the OAuth flow to authenticate with Contextor.
 */
export async function signInCommand(authService: AuthService): Promise<void> {
  try {
    // Check if already authenticated
    const isAuthenticated = await authService.isAuthenticated();
    if (isAuthenticated) {
      const user = await authService.getUser();
      const choice = await vscode.window.showInformationMessage(
        `You are already signed in as ${user?.email || "a user"}. Sign out first?`,
        "Sign Out",
        "Cancel"
      );

      if (choice === "Sign Out") {
        await authService.logout();
        // Continue to sign in
      } else {
        return;
      }
    }

    // Start the OAuth flow
    await authService.login();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    vscode.window.showErrorMessage(`Sign in failed: ${message}`);
  }
}

/**
 * Sign out command handler.
 * Clears all stored credentials and signs out the user.
 */
export async function signOutCommand(authService: AuthService): Promise<void> {
  try {
    // Check if authenticated
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      vscode.window.showInformationMessage("You are not currently signed in.");
      return;
    }

    // Confirm sign out
    const user = await authService.getUser();
    const choice = await vscode.window.showWarningMessage(
      `Are you sure you want to sign out${user?.email ? ` (${user.email})` : ""}?`,
      { modal: true },
      "Sign Out"
    );

    if (choice !== "Sign Out") {
      return;
    }

    // Sign out
    await authService.logout();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    vscode.window.showErrorMessage(`Sign out failed: ${message}`);
  }
}
