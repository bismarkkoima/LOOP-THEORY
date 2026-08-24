# Loop Theory — E-Commerce Prototype

A lightweight, responsive, single-page e-commerce application for **Loop Theory**, built with pure front-end web technologies (no external frameworks or dependencies).

## 🚀 Features

* **Dynamic Product Grid:** Renders product items dynamically based on category filters and live search input.
* **Quick-View Modal:** Detailed product inspector showcasing specs, descriptions, and dynamic SVG visualizers.
* **Persistent Shopping Cart:** Fully functional cart drawer with subtotal calculations and state persistence using `localStorage`.
* **Responsive Layout:** Tailored layout for mobile, tablet, and desktop viewports using CSS Grid and Flexbox.

## 📁 Project Structure

```text
loop-theory/
├── index.html          # Main HTML entry point & DOM markup
├── css/
│   └── styles.css      # Core styles, CSS variables, & responsive rules
├── js/
│   ├── data.js         # Dynamic product data generator & mock catalog
│   └── app.js          # Cart state, search/filter handlers, & UI logic
├── assets/
│   └── images/         # Static assets and media
└── README.md           # Project documentation