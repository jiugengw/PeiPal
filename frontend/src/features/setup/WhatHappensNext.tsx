import type { components } from "@/generated/api";

type OlderAdult = components["schemas"]["OlderAdultResponse"];

interface WhatHappensNextProps {
  olderAdults: OlderAdult[];
}

export function WhatHappensNext({ olderAdults }: WhatHappensNextProps) {
  const names = olderAdults.map(
    (person) => person.preferred_name || person.name,
  );
  const who = names.length ? names.join(" and ") : "your older adult";

  return (
    <div>
      <ol className="list-decimal space-y-3 pl-6 text-lg leading-relaxed text-foreground">
        <li>{who} opens the sign-in link on their own device.</li>
        <li>They find an activity and ask the family about it.</li>
        <li>
          Everyone you added is emailed at once. The first person to answer
          decides, and anyone can offer to help.
        </li>
      </ol>
      <p className="mt-5 text-base leading-relaxed text-foreground">
        You can go back to Setup at any time to change who is in the
        family.
      </p>
    </div>
  );
}
