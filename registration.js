(() => {
  const dialog = document.getElementById("registration-dialog");
  const form = document.getElementById("registration-form");
  const status = document.getElementById("registration-status");
  const responseFrame = document.getElementById("registration-response-frame");

  if (!dialog || !form || !status || !responseFrame) return;

  const startedAt = document.getElementById("form_started_at");
  const submissionToken = document.getElementById("submission_token");
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonLabel = submitButton?.textContent || "Submit registration";
  let activeToken = "";
  let responseTimeout;

  const setStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
    status.setAttribute("role", state === "error" ? "alert" : "status");
    status.hidden = false;
  };

  const clearStatus = () => {
    status.textContent = "";
    status.hidden = true;
    delete status.dataset.state;
    status.setAttribute("role", "status");
  };

  const setSubmitting = (submitting) => {
    if (!submitButton) return;
    submitButton.disabled = submitting;
    submitButton.toggleAttribute("aria-busy", submitting);
    submitButton.textContent = submitting ? "Submitting…" : originalButtonLabel;
  };

  const resetSubmissionState = () => {
    window.clearTimeout(responseTimeout);
    activeToken = "";
    setSubmitting(false);
  };

  const openDialog = () => {
    clearStatus();

    if (typeof dialog.showModal === "function") {
      if (dialog.open) dialog.close();
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    if (startedAt) startedAt.value = String(Date.now());
    window.setTimeout(() => document.getElementById("full_name")?.focus(), 50);
  };

  const closeDialog = () => {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
      form.reset();
      clearStatus();
      resetSubmissionState();
    }
  };

  const configuredEndpoint = () => {
    const endpoint = (form.dataset.endpoint || "").trim();
    const valid = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(endpoint);
    return valid ? endpoint : "";
  };

  const createSubmissionToken = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const randomPart = Math.random().toString(36).slice(2);
    return `${Date.now()}-${randomPart}-${randomPart}`;
  };

  document.querySelectorAll("[data-open-registration]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openDialog();
    });
  });

  document.querySelectorAll("[data-close-registration]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeDialog();
    });
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  dialog.addEventListener("close", () => {
    form.reset();
    clearStatus();
    resetSubmissionState();
  });

  window.addEventListener("message", (event) => {
    const fromGoogle =
      event.origin === "https://script.google.com" ||
      /^https:\/\/script\.googleusercontent\.com$/.test(event.origin);
    const payload = event.data;

    if (
      !fromGoogle ||
      !payload ||
      payload.source !== "mhh-registration" ||
      payload.submissionToken !== activeToken
    ) {
      return;
    }

    resetSubmissionState();

    if (payload.ok) {
      form.reset();
      setStatus(
        payload.message || "Thank you! Your registration has been received.",
        "success",
      );
      return;
    }

    setStatus(
      payload.message || "We could not submit your registration. Please check your details and try again.",
      "error",
    );
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearStatus();

    if (!form.reportValidity()) return;

    const endpoint = configuredEndpoint();
    if (!endpoint) {
      setStatus(
        "Registration is not connected yet. The site owner must add the Google Apps Script web app URL.",
        "error",
      );
      return;
    }

    activeToken = createSubmissionToken();
    submissionToken.value = activeToken;
    if (!startedAt.value) startedAt.value = String(Date.now());

    let originField = form.querySelector('input[name="page_origin"]');
    if (!originField) {
      originField = document.createElement("input");
      originField.type = "hidden";
      originField.name = "page_origin";
      form.appendChild(originField);
    }
    originField.value = window.location.origin;

    form.action = endpoint;
    form.target = responseFrame.name;
    setSubmitting(true);

    responseTimeout = window.setTimeout(() => {
      resetSubmissionState();
      setStatus(
        "The registration service did not respond. Please check your connection and try again.",
        "error",
      );
    }, 20000);

    HTMLFormElement.prototype.submit.call(form);
  });
})();
