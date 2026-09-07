const tabs = [...document.querySelectorAll('[role="tab"]')];
function activate(tab) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
  }
}
for (const tab of tabs) {
  tab.addEventListener("click", () => activate(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    activate(tabs[index]); tabs[index].focus();
  });
}
for (const button of document.querySelectorAll(".copy")) {
  button.addEventListener("click", async () => {
    const code = button.parentElement.querySelector("pre code");
    if (!code) return;
    try { await navigator.clipboard.writeText(code.textContent); document.getElementById("announcement").textContent = "コマンドをコピーしました。環境固有の値を置き換えてから実行してください。"; button.textContent = "コピーしました"; }
    catch { document.getElementById("announcement").textContent = "コピーできませんでした。表示されたコマンドを手動で選択してください。"; }
  });
}
const navLinks = [...document.querySelectorAll("nav a")];
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) {
      for (const link of navLinks) { const active = link.hash === `#${entry.target.id}`; link.classList.toggle("active", active); if (active) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current"); }
    }
  }, { rootMargin: "-10% 0px -70% 0px" });
  for (const section of document.querySelectorAll("section[id]")) observer.observe(section);
}
