import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";
import {
  createSupportOffer,
  supportOffersQueryKey,
  supportOffersQueryOptions,
  withdrawSupportOffer,
  type SupportOffer,
  type SupportOfferList,
  type SupportType,
} from "@/features/family/api/supportQueries";
import { supportTypeLabels, supportTypes } from "@/features/family/supportTypes";

export function SupportOfferPanel({ planId, userId }: { planId: number; userId?: string }) {
  const queryClient = useQueryClient();
  const offersQuery = useQuery(supportOffersQueryOptions(planId));
  const [selectedType, setSelectedType] = useState<SupportType>();
  const [note, setNote] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [withdrawingOffer, setWithdrawingOffer] = useState<SupportOffer>();
  const [notice, setNotice] = useState("");

  const offerMutation = useMutation({
    mutationFn: () => {
      if (!selectedType) throw new Error("Choose one way to help.");
      return createSupportOffer(planId, {
        support_type: selectedType,
        note: note.trim() || null,
      });
    },
    onSuccess: (offer) => {
      queryClient.setQueryData<SupportOfferList>(supportOffersQueryKey(planId), (current) => ({
        support_offers: [...(current?.support_offers.filter((item) => item.id !== offer.id) ?? []), offer],
      }));
      setNotice(`You offered to ${supportTypeLabels[offer.support_type].toLowerCase()}.`);
      setSelectedType(undefined);
      setNote("");
      setIsConfirming(false);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: supportOffersQueryKey(planId) }),
  });

  const withdrawMutation = useMutation({
    mutationFn: (offer: SupportOffer) => withdrawSupportOffer(offer.id),
    onSuccess: (_data, offer) => {
      queryClient.setQueryData<SupportOfferList>(supportOffersQueryKey(planId), (current) => ({
        support_offers: current?.support_offers.filter((item) => item.id !== offer.id) ?? [],
      }));
      setNotice("Your support offer was withdrawn.");
      setWithdrawingOffer(undefined);
    },
  });

  if (offersQuery.isPending) return <p className="mt-5 font-bold text-foreground" role="status">Loading ways to help…</p>;
  if (offersQuery.isError) return <div className="mt-5" role="alert"><p className="font-bold text-foreground">We could not load the support offers.</p><button className={`${secondaryButtonClass} mt-3`} onClick={() => void offersQuery.refetch()} type="button">Try again</button></div>;

  const offers = offersQuery.data.support_offers;
  const myOffers = offers.filter((offer) => offer.offered_by === userId);
  const activeTypes = new Set(myOffers.map((offer) => offer.support_type));

  return (
    <section className="mt-6 border-t border-border pt-6" aria-labelledby={`support-heading-${planId}`}>
      <h3 id={`support-heading-${planId}`} className="text-xl font-bold text-foreground">How could you help?</h3>
      <p className="mt-1 text-base leading-relaxed text-foreground">Choose one small, practical offer. It is optional and can be withdrawn.</p>

      <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Choose a support type</legend>
        {supportTypes.map((type) => {
          const alreadyOffered = activeTypes.has(type);
          return (
            <label className={`flex min-h-14 items-center gap-3 rounded-xl border border-input px-4 py-3 ${alreadyOffered ? "cursor-not-allowed bg-muted opacity-65" : "cursor-pointer bg-background hover:bg-muted"}`} key={type}>
              <input className="size-5 accent-primary" type="radio" name={`support-${planId}`} value={type} checked={selectedType === type} disabled={alreadyOffered || offerMutation.isPending} onChange={() => { setSelectedType(type); setNotice(""); }} />
              <span className="font-bold text-foreground">{supportTypeLabels[type]}{alreadyOffered ? " · You offered" : ""}</span>
            </label>
          );
        })}
      </fieldset>

      {selectedType ? (
        <div className="mt-4">
          <label className="block font-bold text-foreground" htmlFor={`support-note-${planId}`}>Optional note</label>
          <textarea className="mt-2 min-h-28 w-full rounded-xl border border-input bg-background px-4 py-3 text-base text-foreground" id={`support-note-${planId}`} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add any useful detail, such as when you are free." />
        </div>
      ) : null}

      {selectedType && !isConfirming ? <button className={`${primaryButtonClass} mt-4`} onClick={() => setIsConfirming(true)} type="button">Review this offer</button> : null}
      {isConfirming && selectedType ? (
        <div className="mt-4 rounded-2xl bg-muted p-5">
          <h4 className="text-lg font-bold text-foreground">Offer to {supportTypeLabels[selectedType].toLowerCase()}?</h4>
          <p className="mt-1 text-base leading-relaxed text-foreground">This demo records the offer as yours. It does not arrange transport, make a booking, or guarantee attendance.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className={primaryButtonClass} disabled={offerMutation.isPending} onClick={() => offerMutation.mutate()} type="button">{offerMutation.isPending ? "Saving…" : "Offer this help"}</button>
            <button className={secondaryButtonClass} disabled={offerMutation.isPending} onClick={() => setIsConfirming(false)} type="button">Go back</button>
          </div>
        </div>
      ) : null}

      {myOffers.length > 0 ? (
        <div className="mt-6">
          <h4 className="font-bold text-foreground">Your current offers</h4>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {myOffers.map((offer) => (
              <li className="py-3" key={offer.id}>
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div><p className="font-bold text-foreground">{supportTypeLabels[offer.support_type]}</p>{offer.note ? <p className="mt-1 text-base text-foreground">{offer.note}</p> : null}</div>
                  <button className={secondaryButtonClass} onClick={() => setWithdrawingOffer(offer)} type="button">Withdraw</button>
                </div>
                {withdrawingOffer?.id === offer.id ? (
                  <div className="mt-3 rounded-xl bg-muted p-4">
                    <p className="font-bold text-foreground">Withdraw this offer?</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button className={primaryButtonClass} disabled={withdrawMutation.isPending} onClick={() => withdrawMutation.mutate(offer)} type="button">{withdrawMutation.isPending ? "Withdrawing…" : "Confirm withdrawal"}</button>
                      <button className={secondaryButtonClass} disabled={withdrawMutation.isPending} onClick={() => setWithdrawingOffer(undefined)} type="button">Keep offer</button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? <p className="mt-4 rounded-xl bg-muted p-4 font-bold text-foreground" role="status">{notice}</p> : null}
      {offerMutation.isError || withdrawMutation.isError ? <p className="mt-4 font-bold text-foreground" role="alert">We could not update the support offer. Refresh the plan and try again.</p> : null}
    </section>
  );
}
