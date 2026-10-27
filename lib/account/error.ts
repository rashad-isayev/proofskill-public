export class AccountError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
