const screens = Array.from(document.querySelectorAll(".screen"));
const steps = Array.from(document.querySelectorAll("#stepList li"));
const backButton = document.querySelector("#backButton");
const nextButton = document.querySelector("#nextButton");
const contactList = document.querySelector("#contactList");
const contactError = document.querySelector("#contactError");
const profileSummary = document.querySelector("#profileSummary");
const contactSummary = document.querySelector("#contactSummary");
const addContactButton = document.querySelector("#addContact");

const roleOptions = [
  "Join activities",
  "Arrange transport",
  "Send reminders",
  "Help with booking",
];

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

function fieldValue(id) {
  return document.querySelector(`#${id}`).value.trim();
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
        <input type="text" value="${contact.name}" data-field="name" data-index="${index}" />
      </label>
      <label>
        Relationship
        <input type="text" value="${contact.relationship}" data-field="relationship" data-index="${index}" />
      </label>
      <label>
        Phone or email
        <input type="text" value="${contact.contact}" data-field="contact" data-index="${index}" />
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
      <button class="remove-contact" type="button" title="Remove contact" data-remove="${index}">×</button>
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
  profileSummary.innerHTML = `
    <dt>Name</dt>
    <dd>${fieldValue("elderName") || "Not added"}</dd>
    <dt>Home area</dt>
    <dd>${fieldValue("homeArea") || "Not added"}</dd>
    <dt>Language</dt>
    <dd>${fieldValue("language")}</dd>
    <dt>Mobility</dt>
    <dd>${fieldValue("mobility")}</dd>
    <dt>Transport</dt>
    <dd>${fieldValue("transport")}</dd>
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
        `<li><strong>${contact.name}</strong><br>${contact.relationship} · ${contact.role}</li>`,
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
          ? "Start finding activities"
          : "Continue";

  updateProgress();
}

function goNext() {
  if (currentScreen === 5) {
    showScreen(1);
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

addContactButton.addEventListener("click", addContact);
nextButton.addEventListener("click", goNext);
backButton.addEventListener("click", goBack);

renderContacts();
showScreen(0);
