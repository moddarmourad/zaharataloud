let cart = JSON.parse(localStorage.getItem("zahrataloud_cart")) || [];
const DELIVERY_FEE = 20.00;

let defaultProducts = [
  { id: 'drake', name: 'Drake', price: 150, image: 'IMG-20261007-WA0052.jpg', inspiration: 'Inspired by Ultra Male · Jean Paul Gaultier', description: 'A captivating, bold fragrance that leaves an unforgettable signature of warmth and spice.', notes: 'Bergamot · Lavender · Pear · Cinnamon · Vanilla' },
  { id: 'vanguard', name: 'Vanguard', price: 150, image: 'IMG-20261007-WA0050.jpg', inspiration: 'Inspired by Erba Pura · Xerjoff', description: 'A vibrant and luxurious scent blending fresh Mediterranean citrus fruits with warm amber and musk.', notes: 'Orange · Lemon · Bergamot · Fruit Basket · White Musk' },
  { id: 'eclipsed', name: 'Eclipsed', price: 150, image: 'IMG-20261007-WA0051.jpg', inspiration: 'Inspired by J\'adore · Dior', description: 'An iconic, luminous floral bouquet celebrating absolute femininity and elegance.', notes: 'Ylang-Ylang · Damask Rose · Grasse Jasmine · Pear · Melon' }
];

function getProducts() {
  const saved = localStorage.getItem("zahrataloud_products");
  if (!saved) {
    localStorage.setItem("zahrataloud_products", JSON.stringify(defaultProducts));
    return defaultProducts;
  }
  try {
    const parsed = JSON.parse(saved);
    return (parsed && parsed.length > 0) ? parsed : defaultProducts;
  } catch (e) {
    return defaultProducts;
  }
}

function getConfig() {
  const saved = localStorage.getItem("zahrataloud_config");
  const defaults = {
    brand: "Zahrat Al-Oud",
    heroTitle: "Some things stay with you.",
    heroSub: "Inspired by the warmth of oud and the beauty of what endures. Zahrat Al Oud is a perfume brand in the making.",
    heroImg: "WhatsApp Image 2026-10-07 at 5.39.28 PM.jpeg",
    promoImg: "WhatsApp Image 2026-10-07 at 5.11.07 PM.jpeg",
    seoTitle: "Zahrat Al Oud — The art of staying",
    seoDesc: "Zahrat Al Oud is a perfume brand inspired by the warmth of oud and the beauty of lasting memories."
  };
  if (!saved) return defaults;
  try {
    return { ...defaults, ...JSON.parse(saved) };
  } catch(e) {
    return defaults;
  }
}

function applyDynamicConfig() {
  const cfg = getConfig();
  document.title = cfg.seoTitle;
  const metaDesc = document.getElementById("meta-desc");
  if (metaDesc) metaDesc.content = cfg.seoDesc;

  const brandEl = document.getElementById("nav-brand-title");
  if (brandEl) brandEl.textContent = cfg.brand;
  const footerBrand = document.getElementById("footer-brand-title");
  if (footerBrand) footerBrand.textContent = cfg.brand;

  const heroTitle = document.getElementById("hero-title");
  if (heroTitle) heroTitle.innerHTML = cfg.heroTitle.replace("with you", "<span>with you.</span>");
  const heroSub = document.getElementById("hero-subtitle");
  if (heroSub) heroSub.textContent = cfg.heroSub;

  const heroContainer = document.getElementById("hero-art-container");
  if (heroContainer) {
    const mediaFile = cfg.heroImg || "";
    if (mediaFile.endsWith(".mp4") || mediaFile.endsWith(".mov") || mediaFile.endsWith(".webm")) {
      heroContainer.innerHTML = `<video src="${mediaFile}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover;"></video>`;
    } else {
      heroContainer.innerHTML = `<img src="${mediaFile}" alt="Zahrat Al Oud Banner" style="width:100%; height:100%; object-fit:contain;">`;
    }
  }

  const promoImg = document.getElementById("promo-banner-img");
  if (promoImg) promoImg.src = cfg.promoImg;

  const products = getProducts();
  const productList = document.getElementById("product-list");
  if (productList) {
    productList.innerHTML = products.map(p => `
      <article class="product-card" onclick="openProductDetail('${p.name}', '${p.image}', '${p.inspiration}', '${p.description}', '${p.notes}', ${p.price})">
        <div class="product-image-box">
          <img src="${p.image}" alt="${p.name} Perfume Bottle">
        </div>
        <div class="product-info">
          <h3 class="product-title-button">${p.name}</h3>
          <span class="product-price">AED ${parseFloat(p.price).toFixed(2)}</span>
        </div>
        <button type="button" class="add-to-cart" onclick="event.stopPropagation(); addToCartDirect('${p.name}', ${p.price}, '${p.image}')">Add to Bag</button>
      </article>
    `).join("");
  }
}

function saveCart() {
  localStorage.setItem("zahrataloud_cart", JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const cartItemsContainer = document.getElementById("cart-items");
  const navCartCount = document.getElementById("navCartCount");
  const cartSubtotal = document.getElementById("cart-subtotal");
  const cartTotal = document.getElementById("cart-total");

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (navCartCount) navCartCount.textContent = `(${totalCount})`;

  if (cart.length === 0) {
    if (cartItemsContainer) {
      cartItemsContainer.innerHTML = `<p class="cart-empty" style="text-align: center; color: #777064; margin-top: 20px;">Your bag is empty.</p>`;
    }
    if (cartSubtotal) cartSubtotal.textContent = "AED 0.00";
    if (cartTotal) cartTotal.textContent = "AED 0.00";
    return;
  }

  let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let grandTotal = subtotal + DELIVERY_FEE;
  
  if (cartItemsContainer) {
    cartItemsContainer.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-product">
          <img src="${item.image}" alt="${item.name}" class="cart-item-image">
          <div class="cart-item-name">
            <span><strong>${item.name}</strong></span>
            <span>AED ${parseFloat(item.price).toFixed(2)}</span>
          </div>
        </div>
        <div class="quantity-control">
          <button type="button" onclick="window.changeQuantity('${item.id}', -1)">-</button>
          <span>${item.quantity}</span>
          <button type="button" onclick="window.changeQuantity('${item.id}', 1)">+</button>
        </div>
      </div>
    `).join("");
  }

  if (cartSubtotal) cartSubtotal.textContent = `AED ${subtotal.toFixed(2)}`;
  if (cartTotal) cartTotal.textContent = `AED ${grandTotal.toFixed(2)} (incl. AED 20 Delivery)`;
}

window.changeQuantity = function(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id !== productId);
  }
  saveCart();
};

window.addToCartDirect = function(name, price, image) {
  cart = JSON.parse(localStorage.getItem("zahrataloud_cart")) || [];
  const id = name.toLowerCase().replace(/\s+/g, '-');
  const existingItem = cart.find(item => item.id === id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ id, name, price: parseFloat(price), image, quantity: 1 });
  }
  saveCart();

  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  const checkoutForm = document.getElementById("checkout-form");
  
  if (drawer) {
    drawer.classList.remove("checkout-mode");
    const cartBody = drawer.querySelector('.cart-body');
    if (cartBody) cartBody.scrollTop = 0;
  }
  if (checkoutForm) checkoutForm.hidden = false;

  if (drawer) drawer.classList.add("open");
  if (overlay) overlay.classList.add("open");
};

function openProductDetail(name, image, inspiration, description, notes, price) {
  document.getElementById('hero-section').style.display = 'none';
  document.getElementById('shop-main').style.display = 'none';
  document.getElementById('product-detail-view').style.display = 'block';

  document.getElementById('detail-title').textContent = name;
  document.getElementById('detail-img').src = image;
  document.getElementById('detail-price-display').textContent = `AED ${parseFloat(price).toFixed(2)}`;
  document.getElementById('detail-inspiration').textContent = inspiration;
  document.getElementById('detail-description').textContent = description;
  document.getElementById('detail-notes').innerHTML = `<strong>Notes:</strong> ${notes}`;

  const addBtn = document.getElementById('detail-add-btn');
  addBtn.onclick = function() {
    window.addToCartDirect(name, price, image);
  };

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showShopView() {
  document.getElementById('hero-section').style.display = 'grid';
  document.getElementById('shop-main').style.display = 'block';
  document.getElementById('product-detail-view').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addBundleToCart() {
  window.addToCartDirect('Bundle: 3 Luxury Perfumes Offer', 330, 'WhatsApp Image 2026-10-07 at 5.11.07 PM.jpeg');
}

// Master Admin Functions (Cmd + Shift + A -> Moddmohd2003)
function verifyAdminPassword() {
  const pass = document.getElementById("admin-password-input").value;
  if (pass === "Moddmohd2003") {
    document.getElementById("admin-login-view").style.display = "none";
    document.getElementById("admin-panel-view").style.display = "block";
    loadAdminOrders();
    loadAdminProductsForm();
    loadAdminContentForm();
  } else {
    document.getElementById("admin-login-err").style.display = "block";
  }
}

function closeAdminModal() {
  document.getElementById("admin-modal").style.display = "none";
  document.getElementById("admin-password-input").value = "";
  document.getElementById("admin-login-err").style.display = "none";
  document.getElementById("admin-login-view").style.display = "block";
  document.getElementById("admin-panel-view").style.display = "none";
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('admin-tab-' + tabName).classList.add('active');
  event.currentTarget.classList.add('active');

  if (tabName === 'orders') loadAdminOrders();
  if (tabName === 'products') loadAdminProductsForm();
  if (tabName === 'content') loadAdminContentForm();
  if (tabName === 'seo') loadAdminSEOForm();
}

function loadAdminOrders() {
  const orders = JSON.parse(localStorage.getItem("zahrataloud_orders")) || [];
  const container = document.getElementById("admin-orders-container");
  if (orders.length === 0) {
    container.innerHTML = `<p style="color: var(--muted); text-align: center;">No orders recorded yet.</p>`;
    return;
  }
  container.innerHTML = `
    <table style="width:100%; border-collapse:collapse; background:#fff; font-size:13px;">
      <thead>
        <tr style="background: var(--linen);">
          <th style="padding:10px; border:1px solid var(--line);">Order ID</th>
          <th style="padding:10px; border:1px solid var(--line);">Customer</th>
          <th style="padding:10px; border:1px solid var(--line);">Contact</th>
          <th style="padding:10px; border:1px solid var(--line);">Items & Total</th>
          <th style="padding:10px; border:1px solid var(--line);">Address</th>
          <th style="padding:10px; border:1px solid var(--line);">Status & Actions</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map((o, index) => `
          <tr>
            <td style="padding:10px; border:1px solid var(--line);"><strong>${o.id}</strong><br><small>${o.date}</small></td>
            <td style="padding:10px; border:1px solid var(--line);">${o.name}</td>
            <td style="padding:10px; border:1px solid var(--line);">${o.phone}<br>${o.email}</td>
            <td style="padding:10px; border:1px solid var(--line);">${o.items.map(i => `${i.name} x${i.quantity}`).join('<br>')}<br><strong>AED ${parseFloat(o.total).toFixed(2)}</strong></td>
            <td style="padding:10px; border:1px solid var(--line);">${o.emirate}, ${o.address}</td>
            <td style="padding:10px; border:1px solid var(--line);">
              <select onchange="updateOrderStatus(${index}, this.value)" style="padding:4px; margin-bottom: 6px; display:block;">
                <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
                <option value="Out for Delivery" ${o.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>Completed</option>
              </select>
              <button type="button" onclick="deleteOrder(${index})" style="background:#a94442; color:#fff; border:none; padding:4px 8px; font-size:11px; border-radius:3px; cursor:pointer;">Delete Order</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

window.updateOrderStatus = function(index, status) {
  let orders = JSON.parse(localStorage.getItem("zahrataloud_orders")) || [];
  if (orders[index]) {
    orders[index].status = status;
    localStorage.setItem("zahrataloud_orders", JSON.stringify(orders));
    alert("Order status updated!");
  }
};

window.deleteOrder = function(index) {
  if (confirm("Are you sure you want to delete this order?")) {
    let orders = JSON.parse(localStorage.getItem("zahrataloud_orders")) || [];
    orders.splice(index, 1);
    localStorage.setItem("zahrataloud_orders", JSON.stringify(orders));
    loadAdminOrders();
  }
};

function loadAdminProductsForm() {
  const products = getProducts();
  const container = document.getElementById("admin-products-fields");
  container.innerHTML = products.map((p, i) => `
    <div style="background:#fff; padding:15px; border:1px solid var(--line); border-radius:4px; margin-bottom:15px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h4 style="margin:0;">Product ${i+1}: ${p.name}</h4>
        <button type="button" onclick="deleteAdminProduct(${i})" style="background:#a94442; color:#fff; border:none; padding:4px 10px; font-size:12px; border-radius:3px; cursor:pointer;">Delete Product</button>
      </div>
      <div class="form-group"><label>Name</label><input type="text" id="adm-p-name-${i}" value="${p.name}"></div>
      <div class="form-group"><label>Price (AED)</label><input type="number" id="adm-p-price-${i}" value="${p.price}"></div>
      <div class="form-group"><label>Image Filename</label><input type="text" id="adm-p-img-${i}" value="${p.image}"></div>
      <div class="form-group"><label>Inspiration</label><input type="text" id="adm-p-insp-${i}" value="${p.inspiration}"></div>
      <div class="form-group"><label>Description</label><textarea id="adm-p-desc-${i}" rows="2">${p.description}</textarea></div>
      <div class="form-group"><label>Notes</label><input type="text" id="adm-p-notes-${i}" value="${p.notes}"></div>
    </div>
  `).join("");
}

window.addNewProductForm = function() {
  let products = getProducts();
  products.push({
    id: 'new-product-' + Date.now(),
    name: 'New Perfume',
    price: 150,
    image: 'IMG-20261007-WA0052.jpg',
    inspiration: 'Inspired by...',
    description: 'Description here...',
    notes: 'Top · Middle · Base'
  });
  localStorage.setItem("zahrataloud_products", JSON.stringify(products));
  loadAdminProductsForm();
  applyDynamicConfig();
};

window.deleteAdminProduct = function(index) {
  if (confirm("Are you sure you want to delete this product?")) {
    let products = getProducts();
    products.splice(index, 1);
    localStorage.setItem("zahrataloud_products", JSON.stringify(products));
    loadAdminProductsForm();
    applyDynamicConfig();
  }
};

function loadAdminContentForm() {
  const cfg = getConfig();
  document.getElementById("adm-brand").value = cfg.brand;
  document.getElementById("adm-herotitle").value = cfg.heroTitle;
  document.getElementById("adm-herosub").value = cfg.heroSub;
  document.getElementById("adm-heroimg").value = cfg.heroImg;
  document.getElementById("adm-promoimg").value = cfg.promoImg;
}

function saveAdminContent(e) {
  e.preventDefault();
  let cfg = getConfig();
  cfg.brand = document.getElementById("adm-brand").value;
  cfg.heroTitle = document.getElementById("adm-herotitle").value;
  cfg.heroSub = document.getElementById("adm-herosub").value;
  cfg.heroImg = document.getElementById("adm-heroimg").value;
  cfg.promoImg = document.getElementById("adm-promoimg").value;
  localStorage.setItem("zahrataloud_config", JSON.stringify(cfg));
  alert("Hero and Banners updated successfully!");
  applyDynamicConfig();
}

function loadAdminSEOForm() {
  const cfg = getConfig();
  document.getElementById("adm-seotitle").value = cfg.seoTitle;
  document.getElementById("adm-seodesc").value = cfg.seoDesc;
}

function saveAdminSEO(e) {
  e.preventDefault();
  let cfg = getConfig();
  cfg.seoTitle = document.getElementById("adm-seotitle").value;
  cfg.seoDesc = document.getElementById("adm-seodesc").value;
  localStorage.setItem("zahrataloud_config", JSON.stringify(cfg));
  alert("SEO settings updated successfully!");
  applyDynamicConfig();
}

document.addEventListener("DOMContentLoaded", () => {
  applyDynamicConfig();
  updateCartUI();

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      document.getElementById("admin-modal").style.display = "flex";
      document.getElementById("admin-password-input").focus();
    }
  });

  const openBtn = document.getElementById("openCartBtn");
  const closeBtn = document.getElementById("closeCartBtn");
  const overlay = document.getElementById("cartOverlay");
  const continueBtn = document.getElementById("continue-checkout");
  const backBtn = document.getElementById("back-to-bag");
  const drawer = document.getElementById("cartDrawer");

  if (openBtn) openBtn.addEventListener("click", () => { drawer.classList.add("open"); overlay.classList.add("open"); });
  if (closeBtn) closeBtn.addEventListener("click", () => { drawer.classList.remove("open"); overlay.classList.remove("open"); });
  if (overlay) overlay.addEventListener("click", () => { drawer.classList.remove("open"); overlay.classList.remove("open"); });
  
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      drawer.classList.add("checkout-mode");
      const cartBody = drawer.querySelector('.cart-body');
      if (cartBody) cartBody.scrollTop = 0;
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      drawer.classList.remove("checkout-mode");
      const cartBody = drawer.querySelector('.cart-body');
      if (cartBody) cartBody.scrollTop = 0;
    });
  }

  // Contact Form -> Sent to aloudzahrat@gmail.com
  const contactForm = document.getElementById("contact-inquiry-form");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("contact-name").value;
      const email = document.getElementById("contact-email").value;
      const message = document.getElementById("contact-message").value;

      if (typeof emailjs !== 'undefined') {
        emailjs.send("service_3i7fccb", "template_jjj2npo", {
          to_email: "aloudzahrat@gmail.com",
          from_name: name,
          from_email: email,
          message: message
        }).catch(err => console.log(err));
      }
      alert("Thank you for your message! We will get back to you shortly.");
      contactForm.reset();
    });
  }

  // Checkout Form -> Handles COD vs Online Payment (Ziina) + EmailJS
  const checkoutForm = document.getElementById("checkout-form");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (cart.length === 0) return;

      const orderId = "ZAO-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      let total = subtotal + DELIVERY_FEE;
      const itemsSnapshot = [...cart];
      const customerName = document.getElementById("order-name")?.value || "Customer";
      const customerPhone = document.getElementById("order-phone")?.value || "";
      const customerEmail = document.getElementById("order-email")?.value || "";
      const customerEmirate = document.getElementById("order-emirate")?.value || "";
      const customerAddress = document.getElementById("order-address")?.value || "";
      const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || "Cash on delivery";

      const newOrder = {
        id: orderId,
        date: new Date().toLocaleString(),
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        emirate: customerEmirate,
        address: customerAddress,
        payment: paymentMethod,
        items: itemsSnapshot,
        total: total,
        status: "Pending"
      };

      let orders = JSON.parse(localStorage.getItem("zahrataloud_orders")) || [];
      orders.unshift(newOrder);
      localStorage.setItem("zahrataloud_orders", JSON.stringify(orders));

      // Send EmailJS notification
      if (typeof emailjs !== 'undefined') {
        emailjs.send("service_3i7fccb", "template_fp2k9tp", {
          to_email: customerEmail,
          order_id: orderId,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          emirate: customerEmirate,
          address: customerAddress,
          payment: paymentMethod,
          order_total: total.toFixed(2),
          order_items: itemsSnapshot.map(i => `${i.name} (x${i.quantity})`).join(", ")
        }).catch(err => console.log(err));
      }

      // If user selected Online Payment, route directly to Ziina payment link
      if (paymentMethod.toLowerCase().includes("online") || paymentMethod.toLowerCase().includes("ziina")) {
        cart = [];
        localStorage.setItem("zahrataloud_cart", JSON.stringify(cart));
        // Redirects directly to Ziina secure payment checkout page for your store
        window.location.href = `https://pay.ziina.com/zahrataloud?amount=${total}&reference=${orderId}`;
        return;
      }

      // Default fallback / Cash on Delivery flow
      cart = [];
      localStorage.setItem("zahrataloud_cart", JSON.stringify(cart));
      window.location.href = `thankyou.html?id=${orderId}`;
    });
  }
});