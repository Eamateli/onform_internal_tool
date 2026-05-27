// Shared Clerk UI overrides — hides "Secured by Clerk" / Development mode
// footers on SignIn, UserButton popover, and other prebuilt components.
export const clerkAppearance = {
  elements: {
    footer: { display: "none" },
    userButtonPopoverFooter: { display: "none" },
  },
};
