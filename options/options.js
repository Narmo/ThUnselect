const checkbox = document.getElementById("enabled");
const status = document.getElementById("status");

async function loadSetting() {
  try {
    checkbox.checked = await browser.thunselect.getEnabled();
    checkbox.disabled = false;
  } catch (error) {
    status.textContent = "Could not load the setting. Try reopening this page.";
    console.error(error);
  }
}

checkbox.addEventListener("change", async () => {
  checkbox.disabled = true;
  try {
    await browser.thunselect.setEnabled(checkbox.checked);
    status.textContent = "Saved.";
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    status.textContent = "Could not save the setting. Please try again.";
    console.error(error);
  } finally {
    checkbox.disabled = false;
  }
});

loadSetting();
