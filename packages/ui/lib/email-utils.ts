export const cleanEmailAddresses = (emails: string | undefined) =>
  emails && emails.trim()
    ? emails.split(",").map((email) => email.trim().replace(/^<|>$/g, ""))
    : undefined;
