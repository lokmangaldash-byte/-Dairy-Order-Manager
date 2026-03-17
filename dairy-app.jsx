import { useState, useEffect, useCallback } from "react";

// ============================================================
// GOOGLE SHEETS CONFIG
// ============================================================
// Replace these with your actual values after setup (see README)
const SHEET_ID = "YOUR_GOOGLE_SHEET_ID";
const API_KEY = "YOUR_GOOGLE_API_KEY";
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";

const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

const SHEETS = {
  CUSTOMERS: "Customers",
  PRODUCTS: "Products",
  ORDERS: "Orders",
  ORDER_ITEMS: "Order_Items",
};

// ============================================================
// GOOGLE SHEETS SERVICE
// ============================================================
const sheetsService = {
  tokenClient: null,
  accessToken: null,

  async init() {
    return new Promise((resolve) => {
      if (window.google && this.accessToken) { resolve(true); return; }
      resolve(false);
    });
  },

  async authenticate() {
    return new Promise((resolve, reject) => {
      if (!window.google) { reject(new Error("Google API not loaded")); return; }
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) { reject(response); return; }
          this.accessToken = response.access_token;
          resolve(response.access_token);
        },
      });
      tokenClient.requestAccessToken();
    });
  },

  async request(method, range, values = null) {
    if (!this.accessToken) await this.authenticate();
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
    let url, body, fetchOpts;

    if (method === "GET") {
      url = `${base}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
      fetchOpts = { headers: { Authorization: `Bearer ${this.accessToken}` } };
    } else if (method === "APPEND") {
      url = `${base}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
      body = JSON.stringify({ values });
      fetchOpts = { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.accessToken}` }, body };
    } else if (method === "UPDATE") {
      url = `${base}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      body = JSON.stringify({ values });
      fetchOpts = { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.accessToken}` }, body };
    } else if (method === "CLEAR") {
      url = `${base}/values/${encodeURIComponent(range)}:clear`;
      fetchOpts = { method: "POST", headers: { Authorization: `Bearer ${this.accessToken}` } };
    }

    const res = await fetch(url, fetchOpts);
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
    return res.json();
  },

  async getAll(sheet) {
    const data = await this.request("GET", `${sheet}!A:Z`);
    const rows = data.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ""; });
      return obj;
    });
  },

  async append(sheet, headers, rowObj) {
    const row = headers.map(h => rowObj[h] || "");
    await this.request("APPEND", `${sheet}!A:A`, [row]);
  },

  async updateRow(sheet, headers, rowIndex, rowObj) {
    // rowIndex is 1-based, +1 for header row
    const sheetRow = rowIndex + 2;
    const row = headers.map(h => rowObj[h] || "");
    const range = `${sheet}!A${sheetRow}:${String.fromCharCode(64 + headers.length)}${sheetRow}`;
    await this.request("UPDATE", range, [row]);
  },
};

// ============================================================
// SAMPLE DATA (used when not connected to Sheets)
// ============================================================
const sampleData = {
  customers: [
    { customer_id: "C001", name: "Ramesh Kumar", phone: "9876543210", address: "12 MG Road, Pune" },
    { customer_id: "C002", name: "Sunita Sharma", phone: "9845001234", address: "45 Shivaji Nagar, Pune" },
    { customer_id: "C003", name: "Priya Patel", phone: "9731234567", address: "7 Koregaon Park, Pune" },
  ],
  products: [
    { product_id: "P001", product_name: "Full Cream Milk", unit: "liter", price: "60" },
    { product_id: "P002", product_name: "Toned Milk", unit: "liter", price: "50" },
    { product_id: "P003", product_name: "Curd", unit: "kg", price: "80" },
    { product_id: "P004", product_name: "Paneer", unit: "kg", price: "320" },
    { product_id: "P005", product_name: "Ghee", unit: "kg", price: "560" },
    { product_id: "P006", product_name: "Butter", unit: "kg", price: "480" },
  ],
  orders: [
    { order_id: "ORD001", customer_id: "C001", delivery_date: new Date().toISOString().split("T")[0], status: "Pending", total_amount: "240", notes: "" },
    { order_id: "ORD002", customer_id: "C002", delivery_date: new Date().toISOString().split("T")[0], status: "Delivered", total_amount: "560", notes: "Leave at door" },
    { order_id: "ORD003", customer_id: "C003", delivery_date: new Date().toISOString().split("T")[0], status: "Pending", total_amount: "320", notes: "" },
  ],
  order_items: [
    { order_id: "ORD001", product_id: "P001", quantity: "2", price: "60", total: "120" },
    { order_id: "ORD001", product_id: "P003", quantity: "1.5", price: "80", total: "120" },
    { order_id: "ORD002", product_id: "P005", quantity: "1", price: "560", total: "560" },
    { order_id: "ORD003", product_id: "P004", quantity: "1", price: "320", total: "320" },
  ],
};

// ============================================================
// MAIN APP
// ============================================================
export default function DairyOrderManager() {
  const [page, setPage] = useState("dashboard");
  const [connected, setConnected] = useState(false);
  const [customers, setCustomers] = useState(sampleData.customers);
  const [products, setProducts] = useState(sampleData.products);
  const [orders, setOrders] = useState(sampleData.orders);
  const [orderItems, setOrderItems] = useState(sampleData.order_items);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const today = new Date().toISOString().split("T")[0];
  const todayOrders = orders.filter(o => o.delivery_date === today);
  const totalSalesToday = todayOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
  const pendingDeliveries = orders.filter(o => o.status === "Pending").length;

  const connectSheets = async () => {
    try {
      await sheetsService.authenticate();
      const [c, p, o, oi] = await Promise.all([
        sheetsService.getAll(SHEETS.CUSTOMERS),
        sheetsService.getAll(SHEETS.PRODUCTS),
        sheetsService.getAll(SHEETS.ORDERS),
        sheetsService.getAll(SHEETS.ORDER_ITEMS),
      ]);
      if (c.length) setCustomers(c);
      if (p.length) setProducts(p);
      if (o.length) setOrders(o);
      if (oi.length) setOrderItems(oi);
      setConnected(true);
      notify("Connected to Google Sheets!");
    } catch (e) {
      notify("Connection failed. Using demo data.", "error");
    }
  };

  const navItems = [
    { id: "dashboard", icon: "◈", label: "Dashboard" },
    { id: "orders", icon: "📋", label: "Orders" },
    { id: "create-order", icon: "✚", label: "New Order" },
    { id: "customers", icon: "👥", label: "Customers" },
    { id: "products", icon: "🥛", label: "Products" },
  ];

  const navigate = (p) => { setPage(p); setSidebarOpen(false); };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F4F1EC", fontFamily: "'Nunito', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #f0ede6; } ::-webkit-scrollbar-thumb { background: #c8bfb0; border-radius: 3px; }
        input, select, textarea { font-family: 'Nunito', sans-serif; }
        .nav-item { display:flex; align-items:center; gap:10px; padding:10px 16px; border-radius:10px; cursor:pointer; transition:all 0.15s; font-size:14px; font-weight:600; color:#8A7E6E; text-decoration:none; border:none; background:none; width:100%; }
        .nav-item:hover { background:#EDE8DF; color:#3D2B1F; }
        .nav-item.active { background:#3D2B1F; color:#F9F4EE; }
        .btn { padding:9px 18px; border-radius:8px; font-family:'Nunito',sans-serif; font-weight:700; font-size:13px; cursor:pointer; border:none; transition:all 0.15s; }
        .btn-primary { background:#3D2B1F; color:#F9F4EE; }
        .btn-primary:hover { background:#5C3D2E; }
        .btn-outline { background:transparent; color:#3D2B1F; border:1.5px solid #C4B9A8; }
        .btn-outline:hover { background:#EDE8DF; }
        .btn-sm { padding:6px 12px; font-size:12px; }
        .btn-danger { background:#FEE2E2; color:#DC2626; }
        .btn-danger:hover { background:#FECACA; }
        .btn-success { background:#D1FAE5; color:#059669; }
        .card { background:#fff; border-radius:14px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
        .input { width:100%; padding:9px 12px; border:1.5px solid #DDD8CE; border-radius:8px; font-size:14px; outline:none; transition:border 0.15s; background:#FDFCFA; }
        .input:focus { border-color:#3D2B1F; }
        .select { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238A7E6E' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; padding-right:30px; }
        .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; }
        .badge-pending { background:#FEF3C7; color:#D97706; }
        .badge-delivered { background:#D1FAE5; color:#059669; }
        .badge-cancelled { background:#FEE2E2; color:#DC2626; }
        .table-row:hover { background:#FDFCFA; }
        @media (max-width:768px) { .sidebar { transform:translateX(-100%); } .sidebar.open { transform:translateX(0); } .main-content { margin-left:0 !important; } }
      `}</style>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "open" : ""}`} style={{
        width: 220, background: "#FBF8F3", borderRight: "1px solid #EDE8DF",
        position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 100,
        display: "flex", flexDirection: "column", padding: "24px 12px", transition: "transform 0.25s",
      }}>
        <div style={{ padding: "0 8px 24px", borderBottom: "1px solid #EDE8DF" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#B0A493", fontWeight: 700, textTransform: "uppercase" }}>🐄 Dairy</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#3D2B1F", marginTop: 2 }}>Order Manager</div>
        </div>
        <nav style={{ flex: 1, marginTop: 16, display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map(n => (
            <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => navigate(n.id)}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid #EDE8DF", paddingTop: 16 }}>
          <div style={{ padding: "8px 12px", background: connected ? "#D1FAE5" : "#FEF3C7", borderRadius: 8, fontSize: 11, fontWeight: 700, color: connected ? "#059669" : "#D97706", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span>{connected ? "●" : "○"}</span> {connected ? "Sheets Connected" : "Demo Mode"}
          </div>
          {!connected && SHEET_ID !== "YOUR_GOOGLE_SHEET_ID" && (
            <button className="btn btn-outline" style={{ width: "100%", fontSize: 12 }} onClick={connectSheets}>Connect Google Sheets</button>
          )}
        </div>
      </div>

      {/* Mobile Header */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: "#FBF8F3", borderBottom: "1px solid #EDE8DF", display: "flex", alignItems: "center", padding: "0 16px", zIndex: 99, gap: 12 }}>
        <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: 4 }} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#3D2B1F" }}>Dairy Order Manager</span>
      </div>

      {/* Overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "#0005", zIndex: 99 }} />}

      {/* Main */}
      <div className="main-content" style={{ marginLeft: 220, flex: 1, padding: "80px 24px 40px", minWidth: 0 }}>
        {notification && (
          <div style={{ position: "fixed", top: 70, right: 20, zIndex: 200, background: notification.type === "error" ? "#FEE2E2" : "#D1FAE5", color: notification.type === "error" ? "#DC2626" : "#059669", padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
            {notification.msg}
          </div>
        )}

        {page === "dashboard" && <Dashboard orders={orders} customers={customers} todayOrders={todayOrders} totalSalesToday={totalSalesToday} pendingDeliveries={pendingDeliveries} setPage={setPage} setSelectedOrderId={setSelectedOrderId} />}
        {page === "customers" && <CustomersPage customers={customers} setCustomers={setCustomers} connected={connected} notify={notify} />}
        {page === "products" && <ProductsPage products={products} setProducts={setProducts} connected={connected} notify={notify} />}
        {page === "create-order" && <CreateOrderPage customers={customers} products={products} orders={orders} setOrders={setOrders} orderItems={orderItems} setOrderItems={setOrderItems} connected={connected} notify={notify} setPage={setPage} />}
        {page === "orders" && <OrdersPage orders={orders} setOrders={setOrders} customers={customers} setPage={setPage} setSelectedOrderId={setSelectedOrderId} connected={connected} notify={notify} />}
        {page === "order-detail" && <OrderDetailPage orderId={selectedOrderId} orders={orders} setOrders={setOrders} customers={customers} products={products} orderItems={orderItems} setPage={setPage} connected={connected} notify={notify} />}
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ orders, customers, todayOrders, totalSalesToday, pendingDeliveries, setPage, setSelectedOrderId }) {
  const metrics = [
    { label: "Orders Today", value: todayOrders.length, icon: "📋", color: "#3D2B1F", bg: "#EDE8DF" },
    { label: "Sales Today", value: `₹${totalSalesToday.toFixed(0)}`, icon: "💰", color: "#059669", bg: "#D1FAE5" },
    { label: "Pending Deliveries", value: pendingDeliveries, icon: "🚚", color: "#D97706", bg: "#FEF3C7" },
    { label: "Total Customers", value: customers.length, icon: "👥", color: "#7C3AED", bg: "#EDE9FE" },
  ];

  const recentOrders = [...orders].sort((a, b) => b.order_id.localeCompare(a.order_id)).slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#3D2B1F" }}>Good morning 👋</h1>
        <p style={{ color: "#8A7E6E", fontSize: 14, marginTop: 4 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        {metrics.map(m => (
          <div key={m.label} className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{m.icon}</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: m.color, fontWeight: 700 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: "#8A7E6E", fontWeight: 600 }}>{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#3D2B1F" }}>Recent Orders</h2>
          <button className="btn btn-outline btn-sm" onClick={() => setPage("orders")}>View All</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #F0EBE3" }}>
                {["Order ID", "Date", "Status", "Amount", ""].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#8A7E6E", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(o => (
                <tr key={o.order_id} className="table-row" style={{ borderBottom: "1px solid #F4F1EC" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#3D2B1F" }}>{o.order_id}</td>
                  <td style={{ padding: "10px 12px", color: "#6B5E52" }}>{o.delivery_date}</td>
                  <td style={{ padding: "10px 12px" }}><span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>₹{parseFloat(o.total_amount).toFixed(2)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => { setSelectedOrderId(o.order_id); setPage("order-detail"); }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentOrders.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#B0A493" }}>No orders yet</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CUSTOMERS
// ============================================================
function CustomersPage({ customers, setCustomers, notify }) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ customer_id: "", name: "", phone: "", address: "" });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  );

  const nextId = () => `C${String(customers.length + 1).padStart(3, "0")}`;

  const save = () => {
    if (!form.name || !form.phone) { notify("Name and phone required", "error"); return; }
    if (editing !== null) {
      setCustomers(cs => cs.map((c, i) => i === editing ? { ...form } : c));
      notify("Customer updated!");
    } else {
      setCustomers(cs => [...cs, { ...form, customer_id: nextId() }]);
      notify("Customer added!");
    }
    setForm({ customer_id: "", name: "", phone: "", address: "" });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (c, i) => { setForm({ ...c }); setEditing(i); setShowForm(true); };
  const cancel = () => { setForm({ customer_id: "", name: "", phone: "", address: "" }); setEditing(null); setShowForm(false); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#3D2B1F" }}>Customers</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Customer</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid #3D2B1F" }}>
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 800, color: "#3D2B1F" }}>{editing !== null ? "Edit Customer" : "New Customer"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Name *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
            <div><label style={labelStyle}>Phone *</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" /></div>
            <div style={{ gridColumn: "1/-1" }}><label style={labelStyle}>Address</label><input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Delivery address" /></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn btn-outline" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search customers..." style={{ marginBottom: 16, maxWidth: 320 }} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #F0EBE3" }}>
                {["ID", "Name", "Phone", "Address", "Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#8A7E6E", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.customer_id} className="table-row" style={{ borderBottom: "1px solid #F4F1EC" }}>
                  <td style={{ padding: "10px 12px", color: "#B0A493", fontSize: 12 }}>{c.customer_id}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#3D2B1F" }}>{c.name}</td>
                  <td style={{ padding: "10px 12px", color: "#6B5E52" }}>{c.phone}</td>
                  <td style={{ padding: "10px 12px", color: "#6B5E52", maxWidth: 200 }}>{c.address}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => startEdit(c, customers.indexOf(c))}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#B0A493" }}>No customers found</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PRODUCTS
// ============================================================
function ProductsPage({ products, setProducts, notify }) {
  const [form, setForm] = useState({ product_id: "", product_name: "", unit: "liter", price: "" });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const nextId = () => `P${String(products.length + 1).padStart(3, "0")}`;

  const save = () => {
    if (!form.product_name || !form.price) { notify("Name and price required", "error"); return; }
    if (editing !== null) {
      setProducts(ps => ps.map((p, i) => i === editing ? { ...form } : p));
      notify("Product updated!");
    } else {
      setProducts(ps => [...ps, { ...form, product_id: nextId() }]);
      notify("Product added!");
    }
    setForm({ product_id: "", product_name: "", unit: "liter", price: "" });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (p, i) => { setForm({ ...p }); setEditing(i); setShowForm(true); };
  const cancel = () => { setForm({ product_id: "", product_name: "", unit: "liter", price: "" }); setEditing(null); setShowForm(false); };

  const unitColors = { liter: "#DBEAFE", kg: "#D1FAE5", piece: "#FEF3C7" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#3D2B1F" }}>Products</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Product</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid #3D2B1F" }}>
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 800, color: "#3D2B1F" }}>{editing !== null ? "Edit Product" : "New Product"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Product Name *</label><input className="input" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} placeholder="e.g. Full Cream Milk" /></div>
            <div><label style={labelStyle}>Unit *</label>
              <select className="input select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                <option value="liter">Liter</option>
                <option value="kg">Kg</option>
                <option value="piece">Piece</option>
              </select>
            </div>
            <div><label style={labelStyle}>Price (₹) *</label><input className="input" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" /></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn btn-outline" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {products.map((p, i) => (
          <div key={p.product_id} className="card" style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 28 }}>{p.product_name.includes("Milk") ? "🥛" : p.product_name.includes("Ghee") ? "🧈" : p.product_name.includes("Paneer") ? "🧀" : p.product_name.includes("Curd") ? "🥗" : "📦"}</div>
              <span style={{ fontSize: 11, fontWeight: 700, background: unitColors[p.unit] || "#F4F1EC", color: "#3D2B1F", padding: "2px 8px", borderRadius: 20 }}>{p.unit}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#3D2B1F", marginTop: 10 }}>{p.product_name}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#059669", marginTop: 4 }}>₹{parseFloat(p.price).toFixed(0)}<span style={{ fontSize: 12, color: "#8A7E6E", fontFamily: "'Nunito', sans-serif" }}>/{p.unit}</span></div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12, width: "100%" }} onClick={() => startEdit(p, i)}>Edit Price</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// CREATE ORDER
// ============================================================
function CreateOrderPage({ customers, products, orders, setOrders, orderItems, setOrderItems, notify, setPage }) {
  const today = new Date().toISOString().split("T")[0];
  const [customerId, setCustomerId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ product_id: "", quantity: 1, price: 0, total: 0 }]);

  const customer = customers.find(c => c.customer_id === customerId);
  useEffect(() => { if (customer) setAddress(customer.address); }, [customerId]);

  const updateItem = (i, field, val) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === "product_id") {
        const prod = products.find(p => p.product_id === val);
        updated.price = prod ? parseFloat(prod.price) : 0;
      }
      updated.total = parseFloat(updated.quantity || 0) * parseFloat(updated.price || 0);
      return updated;
    }));
  };

  const addItem = () => setItems(prev => [...prev, { product_id: "", quantity: 1, price: 0, total: 0 }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const grandTotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const nextOrderId = () => `ORD${String(orders.length + 1).padStart(3, "0")}`;

  const saveOrder = () => {
    if (!customerId) { notify("Please select a customer", "error"); return; }
    if (!deliveryDate) { notify("Please set a delivery date", "error"); return; }
    if (items.some(i => !i.product_id)) { notify("Please select products for all items", "error"); return; }

    const orderId = nextOrderId();
    const newOrder = { order_id: orderId, customer_id: customerId, delivery_date: deliveryDate, status: "Pending", total_amount: grandTotal.toFixed(2), notes };
    const newItems = items.map(i => ({ order_id: orderId, product_id: i.product_id, quantity: String(i.quantity), price: String(i.price), total: String(i.total) }));

    setOrders(prev => [...prev, newOrder]);
    setOrderItems(prev => [...prev, ...newItems]);
    notify(`Order ${orderId} created!`);
    setPage("orders");
  };

  return (
    <div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#3D2B1F", marginBottom: 24 }}>New Order</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#3D2B1F", marginBottom: 14 }}>Customer & Delivery</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Customer *</label>
              <select className="input select" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.name} — {c.phone}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Delivery Date *</label>
              <input className="input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Delivery Address</label>
              <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" />
            </div>
            <div>
              <label style={labelStyle}>Order Notes</label>
              <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions..." style={{ resize: "vertical" }} />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#3D2B1F", marginBottom: 4 }}>Order Summary</h3>
          <div style={{ fontSize: 12, color: "#8A7E6E", marginBottom: 14 }}>{items.length} product(s) added</div>
          {customer && (
            <div style={{ background: "#F4F1EC", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{customer.name}</div>
              <div style={{ fontSize: 12, color: "#8A7E6E" }}>{customer.phone}</div>
              <div style={{ fontSize: 12, color: "#8A7E6E" }}>{address}</div>
            </div>
          )}
          <div style={{ borderTop: "2px dashed #EDE8DF", paddingTop: 12 }}>
            {items.filter(i => i.product_id).map((i, idx) => {
              const p = products.find(pr => pr.product_id === i.product_id);
              return p ? (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#3D2B1F" }}>
                  <span>{p.product_name} × {i.quantity} {p.unit}</span>
                  <span style={{ fontWeight: 700 }}>₹{i.total.toFixed(2)}</span>
                </div>
              ) : null;
            })}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "2px solid #EDE8DF", fontWeight: 800, fontSize: 16, color: "#3D2B1F" }}>
              <span>Total</span>
              <span style={{ color: "#059669" }}>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#3D2B1F" }}>Products</h3>
          <button className="btn btn-outline btn-sm" onClick={addItem}>+ Add Row</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #F0EBE3" }}>
                {["Product", "Qty", "Unit Price", "Total", ""].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#8A7E6E", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F4F1EC" }}>
                  <td style={{ padding: "8px 6px", minWidth: 180 }}>
                    <select className="input select" value={item.product_id} onChange={e => updateItem(i, "product_id", e.target.value)} style={{ padding: "7px 30px 7px 10px", fontSize: 13 }}>
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "8px 6px", width: 80 }}>
                    <input className="input" type="number" min="0" step="0.5" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} style={{ padding: "7px 10px" }} />
                  </td>
                  <td style={{ padding: "8px 6px", color: "#6B5E52", fontWeight: 600 }}>₹{item.price.toFixed(2)}</td>
                  <td style={{ padding: "8px 6px", fontWeight: 800, color: "#3D2B1F" }}>₹{(item.total || 0).toFixed(2)}</td>
                  <td style={{ padding: "8px 6px" }}>
                    {items.length > 1 && <button className="btn btn-danger btn-sm" onClick={() => removeItem(i)}>✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" style={{ padding: "12px 32px", fontSize: 15 }} onClick={saveOrder}>Save Order</button>
        <button className="btn btn-outline" onClick={() => setPage("orders")}>Cancel</button>
      </div>
    </div>
  );
}

// ============================================================
// ORDERS
// ============================================================
function OrdersPage({ orders, setOrders, customers, setPage, setSelectedOrderId, notify }) {
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = orders.filter(o =>
    (!dateFilter || o.delivery_date === dateFilter) &&
    (!statusFilter || o.status === statusFilter)
  );

  const getCustomerName = id => customers.find(c => c.customer_id === id)?.name || id;

  const updateStatus = (orderId, status) => {
    setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status } : o));
    notify(`Order ${orderId} marked as ${status}`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#3D2B1F" }}>Orders</h1>
        <button className="btn btn-primary" onClick={() => setPage("create-order")}>+ New Order</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={labelStyle}>Filter by Date</label>
            <input className="input" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={labelStyle}>Filter by Status</label>
            <select className="input select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          {(dateFilter || statusFilter) && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn btn-outline btn-sm" onClick={() => { setDateFilter(""); setStatusFilter(""); }}>Clear Filters</button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #F0EBE3" }}>
                {["Order ID", "Customer", "Delivery Date", "Status", "Amount", "Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#8A7E6E", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.order_id} className="table-row" style={{ borderBottom: "1px solid #F4F1EC" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#3D2B1F" }}>{o.order_id}</td>
                  <td style={{ padding: "10px 12px" }}>{getCustomerName(o.customer_id)}</td>
                  <td style={{ padding: "10px 12px", color: "#6B5E52" }}>{o.delivery_date}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <select
                      className="select"
                      value={o.status}
                      onChange={e => updateStatus(o.order_id, e.target.value)}
                      style={{ border: "none", background: "none", fontFamily: "'Nunito',sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer", color: o.status === "Delivered" ? "#059669" : o.status === "Cancelled" ? "#DC2626" : "#D97706" }}
                    >
                      <option value="Pending">⏳ Pending</option>
                      <option value="Delivered">✅ Delivered</option>
                      <option value="Cancelled">❌ Cancelled</option>
                    </select>
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 800 }}>₹{parseFloat(o.total_amount).toFixed(2)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => { setSelectedOrderId(o.order_id); setPage("order-detail"); }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#B0A493" }}>No orders found</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ORDER DETAIL
// ============================================================
function OrderDetailPage({ orderId, orders, setOrders, customers, products, orderItems, setPage, notify }) {
  const order = orders.find(o => o.order_id === orderId);
  if (!order) return <div style={{ padding: 40, color: "#B0A493", textAlign: "center" }}>Order not found. <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={() => setPage("orders")}>Back</button></div>;

  const customer = customers.find(c => c.customer_id === order.customer_id);
  const items = orderItems.filter(i => i.order_id === orderId);

  const updateStatus = (status) => {
    setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status } : o));
    notify(`Status updated to ${status}`);
  };

  const statusColors = { Pending: { bg: "#FEF3C7", color: "#D97706" }, Delivered: { bg: "#D1FAE5", color: "#059669" }, Cancelled: { bg: "#FEE2E2", color: "#DC2626" } };
  const sc = statusColors[order.status] || statusColors.Pending;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setPage("orders")}>← Back</button>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#3D2B1F" }}>Order {orderId}</h1>
        <span style={{ background: sc.bg, color: sc.color, padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{order.status}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#8A7E6E", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Customer</h3>
          {customer ? (
            <>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#3D2B1F" }}>{customer.name}</div>
              <div style={{ color: "#6B5E52", fontSize: 13, marginTop: 4 }}>📞 {customer.phone}</div>
              <div style={{ color: "#6B5E52", fontSize: 13, marginTop: 4 }}>📍 {customer.address}</div>
            </>
          ) : <div style={{ color: "#B0A493" }}>Customer not found</div>}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#8A7E6E", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Order Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[["Order ID", order.order_id], ["Delivery Date", order.delivery_date], ["Notes", order.notes || "—"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#8A7E6E" }}>{k}</span>
                <span style={{ fontWeight: 600, color: "#3D2B1F" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Update Status</label>
            <select className="input select" value={order.status} onChange={e => updateStatus(e.target.value)}>
              <option value="Pending">Pending</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#8A7E6E", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Products Ordered</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #F0EBE3" }}>
              {["Product", "Quantity", "Unit Price", "Total"].map(h => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#8A7E6E", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const prod = products.find(p => p.product_id === item.product_id);
              return (
                <tr key={i} className="table-row" style={{ borderBottom: "1px solid #F4F1EC" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#3D2B1F" }}>{prod?.product_name || item.product_id}</td>
                  <td style={{ padding: "10px 12px" }}>{item.quantity} {prod?.unit || ""}</td>
                  <td style={{ padding: "10px 12px" }}>₹{parseFloat(item.price).toFixed(2)}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 800 }}>₹{parseFloat(item.total).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 12, borderTop: "2px solid #EDE8DF" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#8A7E6E", fontWeight: 700 }}>GRAND TOTAL</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#059669" }}>₹{parseFloat(order.total_amount).toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHARED STYLES
// ============================================================
const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#8A7E6E", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 };
