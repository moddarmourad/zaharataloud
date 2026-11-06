function loginAdmin() {
  const pass = document.getElementById("admin-pass").value;
  if (pass === "admin123" || pass === "mourad2026") {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-dashboard").style.display = "block";
    loadAdminData();
  } else {
    document.getElementById("login-error").hidden = false;
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById('tab-' + tabName).classList.add('active');
  event.currentTarget.classList.add('active');
  
  if (tabName === 'orders') loadOrders();
}

function loadAdminData() {
  loadOrders();
  loadProductsForm();
  loadConfigForm();
}

// 1. Load Orders Tracker
function loadOrders() {
  const orders = JSON.parse(localStorage.getItem("zahrataloud_orders")) || [];
  const tbody = document.getElementById("orders-tbody");
  
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--muted);">No orders received yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map((o, index) => `
    <tr>
      <td><strong>${o.id}</strong><br><small>${o.date}</small></td>
      <td>${o.name}</td>
      <td>${o.phone}<br>${o.email}</td>
      <td>${o.items.map(i => `${i.name} x${i.quantity}`).join('<br>')}<br><strong>AED ${o.total.toFixed(2)}</strong> (${o.payment})</td>
      <td>${o.emirate}<br><small>${o.address}</small></td>
      <td>
        <select class="status-select" onchange="updateOrderStatus(${index}, this.value)">
          <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="Out for Delivery" ${o.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
          <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
    </tr>
  `).join("");
}

function updateOrderStatus(index, newStatus) {
  let orders = JSON.parse(localStorage.getItem("zahrataloud_orders")) || [];
  if (orders[index]) {
    orders[index].status = newStatus;
    localStorage.setItem("zahrataloud_orders", JSON.stringify(orders));
    alert("Order status updated successfully!");
  }
}

// 2. Load Products & Pricing
function loadProductsForm() {
  let products = JSON.parse(localStorage.getItem("zahrataloud_products")) || [
    { id: 'drake', name: 'Drake', price: 150, image: 'IMG-20261007-WA0052.jpg', inspiration: 'Inspired by Ultra Male · Jean Paul Gaultier', description: 'A captivating, bold fragrance...', notes: 'Bergamot · Lavender' },
    { id: 'vanguard', name: 'Vanguard', price: 150, image: 'IMG-20261007-WA0050.jpg', inspiration: 'Inspired by Erba Pura · Xerjoff', description: 'A vibrant and luxurious scent...', notes: 'Orange · Lemon' },
    { id: 'eclipsed', name: 'Eclipsed', price: 150, image: 'IMG-20261007-WA0051.jpg', inspiration: 'Inspired by J\'adore · Dior', description: 'An iconic, luminous floral bouquet...', notes: 'Rose · Jasmine' }
  ];

  const container = document.getElementById("product-fields-container");
  container.innerHTML = products.map((p, i) => `
    <div style="background:#fff; padding:20px; border:1px solid var(--line); border-radius:4px; margin-bottom:15px;">
      <h3>Product ${i+1}: ${p.name}</h3>
      <div class="form-group"><label>Product Name</label><input type="text" id="p-name-${i}" value="${p.name}"></div>
      <div class="form-group"><label>Price (AED)</label><input type="number" id="p-price-${i}" value="${p.price}"></div>
      <div class="form-group"><label>Image Filename</label><input type="text" id="p-img-${i}" value="${p.image}"></div>
      <div class="form-group"><label>Inspiration</label><input type="text" id="p-insp-${i}" value="${p.inspiration}"></div>
      <div class="form-group"><label>Description</label><textarea id="p-desc-${i}" rows="2">${p.description}</textarea></div>
      <div class="form-group"><label>Notes</label><input type="text" id="p-notes-${i}" value="${p.notes}"></div>
    </div>
  `).join("");
}

function saveProducts(e) {
  e.preventDefault();
  let products = [];
  for(let i=0; i<3; i++) {
    products.push({
      id: document.getElementById(`p-name-${i}`).value.toLowerCase().replace(/\s+/g,'-'),
      name: document.getElementById(`p-name-${i}`).value,
      price: parseFloat(document.getElementById(`p-price-${i}`).value),
      image: document.getElementById(`p-img-${i}`).value,
      inspiration: document.getElementById(`p-insp-${i}`).value,
      description: document.getElementById(`p-desc-${i}`).value,
      notes: document.getElementById(`p-notes-${i}`).value
    });
  }
  localStorage.setItem("zahrataloud_products", JSON.stringify(products));
  alert("Products and pricing updated successfully!");
}

// 3. Hero & Banners Config
function loadConfigForm() {
  const cfg = JSON.parse(localStorage.getItem("zahrataloud_config")) || {
    brand: "Zahrat Al-Oud",
    heroTitle: "Some things stay with you.",
    heroSub: "Inspired by the warmth of oud and the beauty of what endures.",
    heroImg: "WhatsApp Image 2026-10-07 at 5.39.28 PM.jpeg",
    promoImg: "WhatsApp Image 2026-10-07 at 5.11.07 PM.jpeg",
    seoTitle: "Zahrat Al Oud — The art of staying",
    seoDesc: "Zahrat Al Oud is a perfume brand inspired by the warmth of oud and the beauty of lasting memories."
  };

  document.getElementById("cfg-brand").value = cfg.brand;
  document.getElementById("cfg-herotitle").value = cfg.heroTitle;
  document.getElementById("cfg-herosub").value = cfg.heroSub;
  document.getElementById("cfg-heroimg").value = cfg.heroImg;
  document.getElementById("cfg-promoimg").value = cfg.promoImg;
  document.getElementById("cfg-seotitle").value = cfg.seoTitle;
  document.getElementById("cfg-seodesc").value = cfg.seoDesc;
}

function saveContent(e) {
  e.preventDefault();
  let cfg = JSON.parse(localStorage.getItem("zahrataloud_config")) || {};
  cfg.brand = document.getElementById("cfg-brand").value;
  cfg.heroTitle = document.getElementById("cfg-herotitle").value;
  cfg.heroSub = document.getElementById("cfg-herosub").value;
  cfg.heroImg = document.getElementById("cfg-heroimg").value;
  cfg.promoImg = document.getElementById("cfg-promoimg").value;
  
  localStorage.setItem("zahrataloud_config", JSON.stringify(cfg));
  alert("Hero and Banners updated successfully!");
}

function saveSEO(e) {
  e.preventDefault();
  let cfg = JSON.parse(localStorage.getItem("zahrataloud_config")) || {};
  cfg.seoTitle = document.getElementById("cfg-seotitle").value;
  cfg.seoDesc = document.getElementById("cfg-seodesc").value;
  
  localStorage.setItem("zahrataloud_config", JSON.stringify(cfg));
  alert("SEO settings updated successfully!");
}