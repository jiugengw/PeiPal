const screens = Array.from(document.querySelectorAll(".screen"));
const steps = Array.from(document.querySelectorAll("#stepList li"));
const setupPanel = document.querySelector(".setup-panel");
const homePanel = document.querySelector("#homePanel");
const homeContent = document.querySelector("#homeContent");
const homeContext = document.querySelector("#homeContext");
const roleTabs = Array.from(document.querySelectorAll(".role-tab"));
const editSetupButton = document.querySelector("#editSetupButton");
const backButton = document.querySelector("#backButton");
const nextButton = document.querySelector("#nextButton");
const contactList = document.querySelector("#contactList");
const contactError = document.querySelector("#contactError");
const profileSummary = document.querySelector("#profileSummary");
const contactSummary = document.querySelector("#contactSummary");
const addContactButton = document.querySelector("#addContact");
const API_BASE_URL = window.COUNT_ME_IN_API_URL || "http://127.0.0.1:8000";

const roleOptions = [
  "Join activities",
  "Arrange transport",
  "Send reminders",
  "Help with booking",
];

let activities = [
  {
    id: "library-craft",
    title: "Quiet craft session",
    venue: "Toa Payoh Public Library",
    timing: "Saturday · 2:00 pm",
    distance: "10 min away",
    cost: "Free",
    detail: "Seated, relaxed, and easy to take at your own pace.",
    tags: ["Seated", "Quiet"],
  },
  {
    id: "community-exercise",
    title: "Gentle morning movement",
    venue: "Toa Payoh Community Club",
    timing: "Tuesday · 9:30 am",
    distance: "8 min away",
    cost: "$3",
    detail: "A friendly, low-impact session with time to rest when needed.",
    tags: ["Nearby", "Gentle"],
  },
  {
    id: "garden-walk",
    title: "Slow garden walk",
    venue: "Bishan-Ang Mo Kio Park",
    timing: "Sunday · 8:30 am",
    distance: "20 min away",
    cost: "Free",
    detail: "An easy outdoor route with shaded benches along the way.",
    tags: ["Outdoors", "Benches"],
  },
];

function activityFromApi(row) {
  const start = row.start_at ? new Date(row.start_at) : null;
  const timing = start && !Number.isNaN(start.valueOf())
    ? start.toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })
    : "Date to be confirmed";
  const cost = row.cost == null ? "Price to be confirmed" : row.cost === 0 ? "Free" : `$${row.cost}`;

  return {
    id: row.dedupe_key || String(row.id),
    title: row.name,
    venue: row.location,
    timing,
    distance: "",
    cost,
    detail: row.description || "Details are available on the event page.",
    tags: row.tags?.length ? row.tags : [row.intensity || "Activity"],
    infoLink: row.info_link,
  };
}

async function loadActivitiesFromApi() {
  const area = encodeURIComponent(fieldValue("homeArea") || "");
  try {
    const response = await fetch(`${API_BASE_URL}/api/activities?location=${area}&limit=10`);
    if (!response.ok) {
      throw new Error(`Activity API returned ${response.status}`);
    }
    const payload = await response.json();
    if (Array.isArray(payload.activities) && payload.activities.length) {
      activities = payload.activities.map(activityFromApi);
    }
  } catch (error) {
    console.warn("Using demo activities because the backend is unavailable.", error);
  }
}

let currentScreen = 0;
let contacts = [
  {
    name: "Anna Lim",
    relationship: "Daughter",
    contact: "+65 9123 4567",
    role: "Arrange transport",
  },
  {
    name: "Shaun Lim",
    relationship: "Grandson",
    contact: "shaun@example.com",
    role: "Send reminders",
  },
];

const homeState = {
  viewMode: "elder",
  prompt: "",
  selectedActivity: null,
  planStatus: "idle",
  supportOffers: {},
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fieldValue(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function profileData() {
  return {
    name: fieldValue("elderName") || "Mary",
    area: fieldValue("homeArea") || "your area",
    language: fieldValue("language"),
    mobility: fieldValue("mobility"),
    transport: fieldValue("transport"),
  };
}

function updateProgress() {
  steps.forEach((step, index) => {
    step.classList.toggle("active", index === currentScreen);
    step.classList.toggle("done", index < currentScreen);
  });
}

function renderContacts() {
  contactList.innerHTML = "";

  contacts.forEach((contact, index) => {
    const row = document.createElement("div");
    row.className = "contact-row";

    row.innerHTML = `
      <label>
        Name
        <input type="text" value="${escapeHtml(contact.name)}" data-field="name" data-index="${index}" />
      </label>
      <label>
        Relationship
        <input type="text" value="${escapeHtml(contact.relationship)}" data-field="relationship" data-index="${index}" />
      </label>
      <label>
        Phone or email
        <input type="text" value="${escapeHtml(contact.contact)}" data-field="contact" data-index="${index}" />
      </label>
      <label>
        Support role
        <select data-field="role" data-index="${index}">
          ${roleOptions
            .map(
              (role) =>
                `<option ${role === contact.role ? "selected" : ""}>${role}</option>`,
            )
            .join("")}
        </select>
      </label>
      <button class="remove-contact" type="button" title="Remove contact" data-remove="${index}">Remove</button>
    `;

    contactList.appendChild(row);
  });
}

function syncContactFromInput(event) {
  const index = Number(event.target.dataset.index);
  const field = event.target.dataset.field;

  if (!Number.isNaN(index) && field) {
    contacts[index][field] = event.target.value;
  }
}

function addContact() {
  contacts.push({
    name: "",
    relationship: "",
    contact: "",
    role: "Join activities",
  });
  contactError.textContent = "";
  renderContacts();
}

function removeContact(index) {
  contacts.splice(index, 1);
  renderContacts();
}

function validContacts() {
  return contacts.some(
    (contact) =>
      contact.name.trim() &&
      contact.relationship.trim() &&
      contact.contact.trim(),
  );
}

function validateCurrentScreen() {
  if (currentScreen === 1 && !fieldValue("elderName")) {
    document.querySelector("#elderName").focus();
    return false;
  }

  if (currentScreen === 2 && !validContacts()) {
    contactError.textContent =
      "Add at least one trusted contact with name, relationship, and phone or email.";
    return false;
  }

  contactError.textContent = "";
  return true;
}

function renderSummary() {
  const profile = profileData();

  profileSummary.innerHTML = `
    <dt>Name</dt>
    <dd>${escapeHtml(profile.name)}</dd>
    <dt>Home area</dt>
    <dd>${escapeHtml(profile.area)}</dd>
    <dt>Language</dt>
    <dd>${escapeHtml(profile.language)}</dd>
    <dt>Mobility</dt>
    <dd>${escapeHtml(profile.mobility)}</dd>
    <dt>Transport</dt>
    <dd>${escapeHtml(profile.transport)}</dd>
  `;

  const visibleContacts = contacts.filter(
    (contact) =>
      contact.name.trim() &&
      contact.relationship.trim() &&
      contact.contact.trim(),
  );

  contactSummary.innerHTML = visibleContacts
    .map(
      (contact) =>
        `<li><strong>${escapeHtml(contact.name)}</strong><br>${escapeHtml(contact.relationship)} · ${escapeHtml(contact.role)}</li>`,
    )
    .join("");
}

function showScreen(index) {
  currentScreen = index;
  screens.forEach((screen, screenIndex) => {
    screen.classList.toggle("active", screenIndex === currentScreen);
  });

  if (currentScreen === 4) {
    renderSummary();
  }

  backButton.hidden = currentScreen === 0;
  nextButton.textContent =
    currentScreen === 0
      ? "Start setup"
      : currentScreen === 4
        ? "Confirm setup"
        : currentScreen === 5
          ? "Go to home"
          : "Continue";

  updateProgress();
}

function showSetup() {
  homePanel.hidden = true;
  setupPanel.hidden = false;
  showScreen(1);
}

function activityById(id) {
  return activities.find((activity) => activity.id === id);
}

function activityCard(activity) {
  return `
    <article class="activity-card">
      <div class="activity-art activity-art-${escapeHtml(activity.id)}" aria-hidden="true">
        <span>${escapeHtml(activity.tags[0])}</span>
      </div>
      <div class="activity-body">
        <div class="activity-heading">
          <div>
            <h3>${escapeHtml(activity.title)}</h3>
            <p>${escapeHtml(activity.venue)}</p>
          </div>
          <span class="activity-cost">${escapeHtml(activity.cost)}</span>
        </div>
        <p class="activity-detail">${escapeHtml(activity.detail)}</p>
        <div class="activity-meta">
          <span>${escapeHtml(activity.timing)}</span>
          <span>${escapeHtml(activity.distance)}</span>
        </div>
        <div class="tag-list">
          ${activity.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <button class="primary activity-interest" type="button" data-activity="${escapeHtml(activity.id)}">
          I’m interested
        </button>
      </div>
    </article>
  `;
}

function selectedPlanCard() {
  const activity = homeState.selectedActivity;
  if (!activity) {
    return "";
  }

  const statusCopy = {
    draft: "This is just for you for now.",
    awaiting_approval: "Jamie has been asked to approve sharing this plan.",
    shared: "Your family can now offer small ways to help.",
  }[homeState.planStatus];

  const action =
    homeState.planStatus === "draft"
      ? `<button class="primary" type="button" data-action="request-approval">Ask Jamie to approve</button>`
      : homeState.planStatus === "awaiting_approval"
        ? `<span class="status-pill status-waiting">Waiting for approval</span>`
        : `<span class="status-pill status-shared">Shared with family</span>`;

  return `
    <section class="plan-card plan-card-elder" aria-labelledby="plan-title">
      <div class="plan-card-heading">
        <div>
          <p class="section-label">Your idea</p>
          <h3 id="plan-title">${escapeHtml(activity.title)}</h3>
        </div>
        <span class="plan-mark" aria-hidden="true"></span>
      </div>
      <p>${escapeHtml(activity.timing)} · ${escapeHtml(activity.venue)}</p>
      <p class="plan-status-copy" aria-live="polite">${statusCopy}</p>
      <div class="plan-actions">
        ${action}
        <button class="secondary" type="button" data-action="change-activity">Choose another</button>
      </div>
    </section>
  `;
}

function supportActionButtons() {
  const actions = [
    ["join", "I can join"],
    ["remind", "Remind her"],
    ["transport", "Arrange transport"],
    ["alternative", "Suggest another"],
    ["booking", "Help with booking"],
  ];

  return actions
    .map(([id, label]) => {
      const active = Boolean(homeState.supportOffers[id]);
      return `<button class="support-action ${active ? "active" : ""}" type="button" data-support="${id}" aria-pressed="${active}">${label}${active ? " · offered" : ""}</button>`;
    })
    .join("");
}

function familyPlanCard() {
  const activity = homeState.selectedActivity;

  if (!activity) {
    return `
      <section class="empty-plan" aria-labelledby="family-empty-title">
        <span class="empty-mark" aria-hidden="true"></span>
        <div>
          <h3 id="family-empty-title">No plan is waiting for you</h3>
          <p>When Mary finds something she likes, you’ll be able to approve it and offer a small way to help.</p>
        </div>
      </section>
    `;
  }

  const pending = homeState.planStatus !== "shared";
  return `
    <section class="plan-card plan-card-family" aria-labelledby="family-plan-title">
      <div class="plan-card-heading">
        <div>
          <p class="section-label">${pending ? "Needs your approval" : "Shared plan"}</p>
          <h3 id="family-plan-title">${escapeHtml(activity.title)}</h3>
        </div>
        <span class="avatar medium" aria-hidden="true">ML</span>
      </div>
      <p>Mary is interested in this for ${escapeHtml(activity.timing.toLowerCase())}.</p>
      <p class="plan-status-copy">${pending ? "Approve sharing it with the trusted circle, or choose another option together." : "The trusted circle can now offer practical support."}</p>
      <div class="plan-actions">
        ${pending ? `<button class="primary" type="button" data-action="approve-plan">Approve and share</button>` : `<span class="status-pill status-shared">Approved and shared</span>`}
        <button class="secondary" type="button" data-action="change-activity">Review activity</button>
      </div>
    </section>
  `;
}

function renderElderHome() {
  const profile = profileData();
  const prompt = homeState.prompt;
  const activityList = prompt
    ? activities.filter((activity) =>
        `${activity.title} ${activity.detail} ${activity.tags.join(" ")}`
          .toLowerCase()
          .includes(prompt.toLowerCase()),
      )
    : activities;
  const visibleActivities = activityList.length ? activityList : activities;

  return `
    <div class="home-intro home-intro-elder">
      <div>
        <p class="section-label">A gentle start</p>
        <h1 id="home-title">Good morning, ${escapeHtml(profile.name)}.</h1>
        <p class="home-lede">What would you like to do? You can tell me in your own words, and we’ll find something that feels comfortable.</p>
      </div>
      <div class="circle-note">
        <span class="avatar large" aria-hidden="true">${escapeHtml(profile.name.slice(0, 2).toUpperCase())}</span>
        <p><strong>Your support circle is ready.</strong><br>Nothing is shared until you choose.</p>
      </div>
    </div>

    <form class="prompt-bar" id="activityPromptForm">
      <label for="activityPrompt">Tell me what you’d like to do</label>
      <div class="prompt-input-row">
        <input id="activityPrompt" name="activityPrompt" value="${escapeHtml(prompt)}" placeholder="Something relaxing this weekend" autocomplete="off" />
        <button class="voice-button" type="button" data-action="voice-prompt">Speak</button>
        <button class="primary" type="submit">Find ideas</button>
      </div>
      <p class="prompt-status" id="promptStatus" role="status">Try a short phrase, or choose one below.</p>
      <div class="quick-prompts" aria-label="Suggested ideas">
        ${["Relaxing", "Meet people", "Stay nearby", "Gentle outdoors"].map((item) => `<button class="quick-prompt" type="button" data-prompt="${item}">${item}</button>`).join("")}
      </div>
    </form>

    ${homeState.selectedActivity ? selectedPlanCard() : ""}

    <section class="activity-section" aria-labelledby="activity-heading">
      <div class="section-heading-row">
        <div>
          <p class="section-label">Near ${escapeHtml(profile.area)}</p>
          <h2 id="activity-heading">Ideas that may feel right</h2>
        </div>
        <span class="result-count">${visibleActivities.length} ideas</span>
      </div>
      <div class="activity-grid">${visibleActivities.map(activityCard).join("")}</div>
    </section>
  `;
}

function renderFamilyHome() {
  const profile = profileData();
  const visibleContacts = contacts.filter((contact) => contact.name.trim());

  return `
    <div class="home-intro home-intro-family">
      <div>
        <p class="section-label">Family view</p>
        <h1 id="home-title">Help Mary make a plan that feels easy.</h1>
        <p class="home-lede">You’re the main approver. The trusted circle can offer small, practical support without anyone having to carry the whole plan.</p>
      </div>
      <div class="family-profile-card">
        <span class="avatar large" aria-hidden="true">${escapeHtml(profile.name.slice(0, 2).toUpperCase())}</span>
        <div><strong>${escapeHtml(profile.name)}</strong><span>${escapeHtml(profile.area)} · ${escapeHtml(profile.mobility)}</span></div>
      </div>
    </div>

    ${familyPlanCard()}

    <section class="support-section" aria-labelledby="support-heading">
      <div class="section-heading-row">
        <div>
          <p class="section-label">Small ways to help</p>
          <h2 id="support-heading">Support without pressure</h2>
        </div>
        <span class="circle-count">${visibleContacts.length} people in circle</span>
      </div>
      <div class="support-action-grid">${supportActionButtons()}</div>
      <p class="support-feedback" id="supportFeedback" role="status">Choose any support you can offer. You can change it later.</p>
    </section>

    <section class="family-details" aria-label="Family setup details">
      <article class="detail-panel">
        <p class="section-label">Helpful context</p>
        <h3>Make recommendations comfortable</h3>
        <dl>
          <dt>Language</dt><dd>${escapeHtml(profile.language)}</dd>
          <dt>Transport</dt><dd>${escapeHtml(profile.transport)}</dd>
        </dl>
      </article>
      <article class="detail-panel">
        <p class="section-label">Trusted circle</p>
        <h3>People who can help</h3>
        <ul class="trusted-list">
          ${visibleContacts.map((contact) => `<li><span class="mini-avatar">${escapeHtml(contact.name.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(contact.role)}</small></span></li>`).join("")}
        </ul>
      </article>
    </section>
  `;
}

function renderHome() {
  const isFamily = homeState.viewMode === "family";
  homeContext.textContent = isFamily ? "Helping a trusted circle work together" : "A gentle place to find something you’d enjoy";
  roleTabs.forEach((tab) => {
    const active = tab.dataset.view === homeState.viewMode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  homePanel.dataset.view = homeState.viewMode;
  homeContent.innerHTML = isFamily ? renderFamilyHome() : renderElderHome();
}

function showHome() {
  setupPanel.hidden = true;
  homePanel.hidden = false;
  renderHome();
  homePanel.querySelector("button, input")?.focus();
  loadActivitiesFromApi().then(renderHome);
}

function selectActivity(id) {
  homeState.selectedActivity = activityById(id);
  homeState.planStatus = "draft";
  homeState.viewMode = "elder";
  renderHome();
  homeContent.querySelector("[data-action='request-approval']")?.focus();
}

function handleHomeAction(action) {
  if (action === "request-approval") {
    homeState.planStatus = "awaiting_approval";
    renderHome();
    return;
  }

  if (action === "approve-plan") {
    homeState.planStatus = "shared";
    homeState.viewMode = "family";
    renderHome();
    return;
  }

  if (action === "change-activity") {
    homeState.selectedActivity = null;
    homeState.planStatus = "idle";
    renderHome();
  }
}

function goNext() {
  if (currentScreen === 5) {
    showHome();
    return;
  }

  if (!validateCurrentScreen()) {
    return;
  }

  showScreen(Math.min(currentScreen + 1, screens.length - 1));
}

function goBack() {
  showScreen(Math.max(currentScreen - 1, 0));
}

contactList.addEventListener("input", syncContactFromInput);
contactList.addEventListener("change", syncContactFromInput);
contactList.addEventListener("click", (event) => {
  const index = Number(event.target.dataset.remove);
  if (!Number.isNaN(index)) {
    removeContact(index);
  }
});

homePanel.addEventListener("click", (event) => {
  const view = event.target.dataset.view;
  const activityId = event.target.dataset.activity;
  const prompt = event.target.dataset.prompt;
  const action = event.target.dataset.action;
  const support = event.target.dataset.support;

  if (view) {
    homeState.viewMode = view;
    renderHome();
    return;
  }

  if (activityId) {
    selectActivity(activityId);
    return;
  }

  if (prompt) {
    homeState.prompt = prompt;
    renderHome();
    return;
  }

  if (support) {
    homeState.supportOffers[support] = !homeState.supportOffers[support];
    renderHome();
    return;
  }

  if (action === "voice-prompt") {
    const promptStatus = document.querySelector("#promptStatus");
    if (promptStatus) {
      promptStatus.textContent = "Voice demo ready — try typing “something relaxing” for now.";
    }
    return;
  }

  if (action) {
    handleHomeAction(action);
  }
});

homePanel.addEventListener("submit", (event) => {
  if (event.target.id !== "activityPromptForm") {
    return;
  }

  event.preventDefault();
  homeState.prompt = event.target.activityPrompt.value.trim();
  renderHome();
});

editSetupButton.addEventListener("click", showSetup);
addContactButton.addEventListener("click", addContact);
nextButton.addEventListener("click", goNext);
backButton.addEventListener("click", goBack);

renderContacts();
showScreen(0);
