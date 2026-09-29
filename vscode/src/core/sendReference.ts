import type { SupportedAgent } from "./agent";
import { buildReference, type ReferenceInput } from "./reference";

export interface SendHost<T> {
  save(): Promise<boolean>;
  recipients(): Promise<readonly T[]>;
  send(recipient: T, reference: string): Promise<void>;
}

export interface DeliveryFailure<T> {
  readonly recipient: T;
  readonly error: unknown;
}

export type SendResult<T> =
  | { readonly status: "save-failed" }
  | { readonly status: "no-recipients"; readonly reference: string }
  | {
      readonly status: "sent";
      readonly reference: string;
      readonly recipientCount: number;
      readonly failures: readonly DeliveryFailure<T>[];
    };

export async function sendReference<T>(
  input: ReferenceInput,
  agent: SupportedAgent,
  host: SendHost<T>,
): Promise<SendResult<T>> {
  if (!(await host.save())) {
    return { status: "save-failed" };
  }
  const reference = buildReference(input, agent);
  const recipients = await host.recipients();
  if (recipients.length === 0) {
    return { status: "no-recipients", reference };
  }
  const failures: DeliveryFailure<T>[] = [];
  for (const recipient of recipients) {
    try {
      await host.send(recipient, reference);
    } catch (error) {
      failures.push({ recipient, error });
    }
  }

  return {
    status: "sent",
    reference,
    recipientCount: recipients.length,
    failures,
  };
}
