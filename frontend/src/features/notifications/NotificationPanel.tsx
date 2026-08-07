import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";
import {
  notificationsQueryKey,
  notificationsQueryOptions,
  sendPlanNotifications,
  type NotificationDelivery,
} from "@/features/notifications/api/notificationQueries";

type TrustedContact = components["schemas"]["TrustedContactResponse"];

export function NotificationPanel({
  planId,
  contacts,
}: {
  planId: number;
  contacts: TrustedContact[];
}) {
  const queryClient = useQueryClient();
  const historyQuery = useQuery(notificationsQueryOptions(planId));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const notifications = historyQuery.data?.notifications ?? [];
  const sentContactIds = new Set(
    notifications
      .filter((item) => item.status === "sent")
      .map((item) => item.trusted_contact_id),
  );

  const sendMutation = useMutation({
    mutationFn: () => sendPlanNotifications(planId, selectedIds),
    onSuccess: (result) => {
      setDeliveries(result.deliveries);
      setSelectedIds([]);
      setIsConfirming(false);
      void queryClient.invalidateQueries({
        queryKey: notificationsQueryKey(planId),
      });
    },
  });

  function toggleContact(contactId: number) {
    setDeliveries([]);
    setSelectedIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId],
    );
  }

  function reviewRetry() {
    const failedIds =
      notifications
        .filter((item) => item.status === "failed")
        .map((item) => item.trusted_contact_id);
    setSelectedIds(failedIds);
    setDeliveries([]);
    setIsConfirming(failedIds.length > 0);
  }

  const selectedNames = contacts
    .filter((contact) => selectedIds.includes(contact.id))
    .map((contact) => contact.name);
  const hasFailedHistory = notifications.some(
    (item) => item.status === "failed",
  );

  return (
    <section className="mt-10 border-y border-border bg-background px-5 py-7 sm:px-7" aria-labelledby="notification-heading">
      <h2 id="notification-heading" className="text-2xl font-bold tracking-[-0.025em] text-foreground">
        Let the trusted circle know
      </h2>
      <p className="mt-2 max-w-[65ch] text-lg leading-relaxed text-foreground">
        Choose who should receive this plan by email. Nobody is contacted until you confirm below.
      </p>

      {historyQuery.isPending ? (
        <p className="mt-5 font-bold text-foreground" role="status">Loading email history…</p>
      ) : historyQuery.isError ? (
        <div className="mt-5" role="alert">
          <p className="font-bold text-foreground">We could not load the email history.</p>
          <button className={`${secondaryButtonClass} mt-3`} onClick={() => void historyQuery.refetch()} type="button">Try again</button>
        </div>
      ) : (
        <fieldset className="mt-6 divide-y divide-border border-y border-border">
          <legend className="sr-only">Trusted contacts</legend>
          {contacts.map((contact) => {
            const wasSent = sentContactIds.has(contact.id);
            const disabled = !contact.email || wasSent;
            return (
              <label key={contact.id} className={`flex min-h-20 gap-4 py-4 ${disabled ? "cursor-not-allowed opacity-65" : "cursor-pointer"}`}>
                <input
                  className="mt-1 size-6 shrink-0 accent-primary"
                  type="checkbox"
                  checked={selectedIds.includes(contact.id)}
                  disabled={disabled || sendMutation.isPending}
                  onChange={() => toggleContact(contact.id)}
                />
                <span className="min-w-0">
                  <span className="block text-lg font-bold text-foreground">{contact.name}</span>
                  <span className="block text-base leading-relaxed text-foreground">
                    {contact.relationship} · {!contact.email ? "No email address saved" : wasSent ? "Email already sent" : contact.email}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {!isConfirming ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button className={primaryButtonClass} disabled={selectedIds.length === 0 || sendMutation.isPending} onClick={() => setIsConfirming(true)} type="button">Review email recipients</button>
          {hasFailedHistory ? <button className={secondaryButtonClass} onClick={reviewRetry} type="button">Retry failed emails</button> : null}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-muted p-5">
          <h3 className="text-xl font-bold text-foreground">Send this plan to {formatNames(selectedNames)}?</h3>
          <p className="mt-2 text-base leading-relaxed text-foreground">Each selected person will receive one email. Contacts already reached will not receive a duplicate.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button className={primaryButtonClass} disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()} type="button">{sendMutation.isPending ? "Sending…" : "Send plan emails"}</button>
            <button className={secondaryButtonClass} disabled={sendMutation.isPending} onClick={() => setIsConfirming(false)} type="button">Change recipients</button>
          </div>
        </div>
      )}

      {sendMutation.isError ? <p className="mt-5 font-bold text-foreground" role="alert">{sendMutation.error.message} Check the recipients and try again.</p> : null}
      {deliveries.length > 0 ? <DeliveryResults deliveries={deliveries} /> : null}
      {notifications.length > 0 ? (
        <div className="mt-7">
          <h3 className="text-lg font-bold text-foreground">Email history</h3>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {notifications.map((item) => (
              <li className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center" key={item.id}>
                <span className="font-bold text-foreground">{item.recipient_name}</span>
                <span className="text-base text-foreground">{historyLabel(item.status)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function DeliveryResults({ deliveries }: { deliveries: NotificationDelivery[] }) {
  const hasFailure = deliveries.some((item) => item.status === "failed");
  return (
    <div className="mt-6" role="status" aria-live="polite">
      <h3 className="text-lg font-bold text-foreground">{hasFailure ? "Some emails need another try" : "Email delivery complete"}</h3>
      <ul className="mt-2 divide-y divide-border border-y border-border">
        {deliveries.map((delivery) => (
          <li className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center" key={delivery.contact_id}>
            <span className="font-bold text-foreground">{delivery.name}</span>
            <span className="text-base text-foreground">{delivery.status === "sent" ? "Email sent" : delivery.status === "already_sent" ? "Already sent" : "Could not send"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function historyLabel(status: "pending" | "sent" | "failed") {
  if (status === "sent") return "Email sent";
  if (status === "failed") return "Could not send";
  return "Sending";
}

function formatNames(names: string[]) {
  if (names.length < 2) return names[0] ?? "the selected contacts";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}
