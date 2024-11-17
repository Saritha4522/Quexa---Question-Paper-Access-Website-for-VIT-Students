// adjust-padding.js
const containerHeight = document.querySelector(".nav").offsetHeight;
const margin = containerHeight;
const bodyDiv = document.querySelector("body");
bodyDiv.style.paddingTop = `${margin}px`;
