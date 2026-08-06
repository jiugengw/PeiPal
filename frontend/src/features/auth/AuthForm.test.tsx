import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProviders } from "@/app/providers/AppProviders";
import { AuthForm } from "@/features/auth/AuthForm";
import { signIn } from "@/features/auth/signIn";
import { signUp } from "@/features/auth/signUp";

vi.mock("@/features/auth/signIn", () => ({ signIn: vi.fn() }));
vi.mock("@/features/auth/signUp", () => ({ signUp: vi.fn() }));

const signInMock = vi.mocked(signIn);
const signUpMock = vi.mocked(signUp);

function renderAuthForm() {
  return render(
    <AppProviders>
      <AuthForm />
    </AppProviders>,
  );
}

describe("AuthForm", () => {
  beforeEach(() => {
    signInMock.mockReset();
    signUpMock.mockReset();
  });

  it("switches between login and account creation", async () => {
    const user = userEvent.setup();
    renderAuthForm();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /create account/i }));
    expect(screen.getByLabelText(/full name/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeVisible();
  });

  it("shows useful validation and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    renderAuthForm();
    await user.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(screen.getByLabelText(/email address/i)).toHaveFocus();
    expect(screen.getByText(/enter your email address/i)).toBeVisible();
    expect(screen.getByText(/enter your password/i)).toBeVisible();
  });

  it("reveals and hides the password", async () => {
    const user = userEvent.setup();
    renderAuthForm();
    const password = screen.getByLabelText(/^password$/i);
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("logs in through Supabase", async () => {
    signInMock.mockResolvedValue();
    const user = userEvent.setup();
    renderAuthForm();
    await user.type(
      screen.getByLabelText(/email address/i),
      "person@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "safe-passphrase");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));
    expect(signInMock).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "safe-passphrase",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      /taking you to setup/i,
    );
  });

  it("clears entered values and status when the mode changes", async () => {
    signInMock.mockResolvedValue();
    const user = userEvent.setup();
    renderAuthForm();
    await user.type(
      screen.getByLabelText(/email address/i),
      "person@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "safe-passphrase");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));
    await screen.findByRole("status");
    await user.click(screen.getByRole("tab", { name: /create account/i }));
    expect(screen.getByLabelText(/email address/i)).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("creates a Supabase account and asks for email confirmation", async () => {
    signUpMock.mockResolvedValue({ confirmationRequired: true });
    const user = userEvent.setup();
    renderAuthForm();
    await user.click(screen.getByRole("tab", { name: /create account/i }));
    await user.type(screen.getByLabelText(/full name/i), "Mary Lim");
    await user.type(
      screen.getByLabelText(/email address/i),
      "mary@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "safe-passphrase");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(signUpMock).toHaveBeenCalledWith({
      fullName: "Mary Lim",
      email: "mary@example.com",
      password: "safe-passphrase",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      /check your email/i,
    );
  });
});
