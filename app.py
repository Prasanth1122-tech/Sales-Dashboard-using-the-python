
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from pathlib import Path

st.set_page_config(
    page_title="Sales Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ---------- Styling ----------
st.markdown("""
<style>
    .stApp {
        background: linear-gradient(135deg, #f4f7fb 0%, #eaf0f8 100%);
    }
    .main {
        background: transparent;
    }
    .block-container {
        padding-top: 2.5rem !important;
        padding-bottom: 2rem;
    }
    .dashboard-title {
        font-size: 34px;
        line-height: 1.3;
        font-weight: 800;
        color: #14265c;
        margin: 0 0 4px 0;
        padding-top: 2px;
    }
    .dashboard-subtitle {
        color: #667085;
        font-size: 15px;
        margin-bottom: 20px;
    }
    .kpi {
        background: white;
        border-radius: 14px;
        padding: 18px;
        border: 1px solid #e7ebf3;
        box-shadow: 0 3px 12px rgba(20,38,92,0.06);
        min-height: 120px;
    }
    .kpi-label {
        color: #667085;
        font-size: 14px;
        font-weight: 600;
    }
    .kpi-value {
        color: #14265c;
        font-size: 28px;
        font-weight: 800;
        margin-top: 7px;
    }
    .section-title {
        color: #14265c;
        font-weight: 750;
        font-size: 19px;
        margin: 8px 0 10px 0;
    }
    .filter-label {
        color: #344054;
        font-size: 14px;
        margin: 4px 0 2px 0;
        line-height: 1.2;
    }
    [data-testid="stSidebar"] [data-testid="stPopover"] {
        margin-bottom: 4px;
    }
    [data-testid="stSidebar"] {
        background-color: #ffffff;
        border-right: 1px solid #e7ebf3;
    }
    [data-testid="stSidebar"] [data-testid="stPopover"] > button {
        background: #ffffff;
        border: 1px solid #d0d5dd;
        border-radius: 6px;
        color: #344054;
        min-height: 42px;
        text-align: left;
        justify-content: space-between;
    }
</style>
""", unsafe_allow_html=True)

# ---------- Helpers ----------
REQUIRED_COLUMNS = ["Date", "Product", "Category", "Region", "Sales", "Quantity", "Profit"]
CHART_HEIGHT = 380
PLOTLY_CONFIG = {"displayModeBar": False, "responsive": True}
CHART_KEYS = [
    "monthly_trend_chart",
    "category_sales_chart",
    "region_sales_chart",
    "category_profit_chart",
    "top_products_chart",
    "sales_profit_chart",
]

def clean_data(df):
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]

    # Flexible matching for common column names
    aliases = {
        "Order Date": "Date",
        "OrderDate": "Date",
        "Product Name": "Product",
        "Product_Name": "Product",
        "Sub-Category": "Category",
        "Sub Category": "Category",
        "Region Name": "Region",
        "Amount": "Sales",
        "Revenue": "Sales",
        "Units": "Quantity",
        "Qty": "Quantity",
        "Cost Profit": "Profit",
    }

    for old, new in aliases.items():
        if old in df.columns and new not in df.columns:
            df.rename(columns={old: new}, inplace=True)

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        return None, missing

    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    for c in ["Sales", "Quantity", "Profit"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    df = df.dropna(subset=["Date", "Sales", "Quantity", "Profit"])
    df["Product"] = df["Product"].fillna("Unknown").astype(str)
    df["Category"] = df["Category"].fillna("Unknown").astype(str)
    df["Region"] = df["Region"].fillna("Unknown").astype(str)

    return df, []

def money(value):
    return f"${value:,.0f}"

def filter_dropdown(label, options, key, all_label):
    selected = st.session_state[key]
    if len(selected) == len(options):
        summary = all_label
    elif not selected:
        summary = "No selections"
    elif len(selected) <= 2:
        summary = ", ".join(selected)
    else:
        summary = f"{len(selected)} selected"

    option_signature = tuple(options)
    signature_key = f"{key}_option_signature"
    select_all_key = f"{key}_select_all"
    if st.session_state.get(signature_key) != option_signature:
        for index, option in enumerate(options):
            st.session_state[f"{key}_option_{index}"] = option in selected
        st.session_state[signature_key] = option_signature
        st.session_state[select_all_key] = len(selected) == len(options)

    st.sidebar.markdown(f"<div class='filter-label'>{label}</div>", unsafe_allow_html=True)
    with st.sidebar.popover(summary, use_container_width=True):
        st.checkbox(
            "Select all",
            key=select_all_key,
            on_change=set_all_filter_options,
            args=(key, options, select_all_key),
        )
        for index, option in enumerate(options):
            st.checkbox(
                option,
                key=f"{key}_option_{index}",
                on_change=sync_filter_options,
                args=(key, options, select_all_key),
            )
    return st.session_state[key]

def set_all_filter_options(key, options, select_all_key):
    selected_all = st.session_state[select_all_key]
    st.session_state[key] = list(options) if selected_all else []
    for index in range(len(options)):
        st.session_state[f"{key}_option_{index}"] = selected_all

def sync_filter_options(key, options, select_all_key):
    st.session_state[key] = [
        option for index, option in enumerate(options)
        if st.session_state.get(f"{key}_option_{index}", False)
    ]
    st.session_state[select_all_key] = len(st.session_state[key]) == len(options)

def clear_chart_action():
    st.session_state["chart_action"] = {}
    for chart_key in CHART_KEYS:
        st.session_state.pop(chart_key, None)
        st.session_state.pop(f"{chart_key}_seen", None)

def reset_all_filters(regions, categories, products, min_date, max_date):
    st.session_state["filter_date_range"] = (min_date, max_date)
    for key, options in (
        ("filter_regions", regions),
        ("filter_categories", categories),
        ("filter_products", products),
    ):
        st.session_state[key] = list(options)
        st.session_state[f"{key}_option_signature"] = tuple(options)
        st.session_state[f"{key}_select_all"] = True
        for index in range(len(options)):
            st.session_state[f"{key}_option_{index}"] = True
    clear_chart_action()

def show_chart(fig, key, dimensions):
    fig.update_layout(height=CHART_HEIGHT, autosize=True)
    chart_state = st.plotly_chart(
        fig,
        use_container_width=True,
        config=PLOTLY_CONFIG,
        key=key,
        on_select="rerun",
        selection_mode="points",
    )

    selection = chart_state.get("selection", {})
    points = selection.get("points", [])
    point_signature = repr([
        (point.get("point_index"), point.get("customdata"))
        for point in points
    ])
    seen_key = f"{key}_seen"
    if point_signature == st.session_state.get(seen_key):
        return

    st.session_state[seen_key] = point_signature
    if not points:
        return

    customdata = points[0].get("customdata", [])
    if not isinstance(customdata, (list, tuple)):
        customdata = [customdata]
    while len(customdata) == 1 and isinstance(customdata[0], (list, tuple)):
        customdata = customdata[0]
    action = {
        dimension: customdata[index]
        for index, dimension in enumerate(dimensions)
        if index < len(customdata)
    }
    if action:
        st.session_state["chart_action"] = action
        st.rerun()

# ---------- Header ----------
st.markdown('<div class="dashboard-title">📊 Sales Dashboard</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="dashboard-subtitle">Upload your Excel sales data and explore interactive business insights.</div>',
    unsafe_allow_html=True
)

# ---------- File upload ----------
uploaded_file = st.file_uploader(
    "Upload Excel File",
    type=["xlsx", "xls"],
    help="Excel must contain Date, Product, Category, Region, Sales, Quantity and Profit columns."
)

# Try sample file automatically
if uploaded_file is not None:
    workbook_sheets = pd.read_excel(uploaded_file, sheet_name=None)
else:
    sample_path = Path(__file__).resolve().parent / "data" / "sample_sales.xlsx"
    if sample_path.exists():
        workbook_sheets = pd.read_excel(sample_path, sheet_name=None)
    else:
        st.info("Upload an Excel file to start.")
        st.stop()

valid_sheets = []
skipped_sheets = {}
for sheet_name, sheet_df in workbook_sheets.items():
    cleaned_sheet, missing = clean_data(sheet_df)
    if missing:
        skipped_sheets[sheet_name] = missing
    elif not cleaned_sheet.empty:
        valid_sheets.append(cleaned_sheet)

if skipped_sheets:
    skipped_details = "; ".join(
        f"{sheet_name} (missing: {', '.join(missing)})"
        for sheet_name, missing in skipped_sheets.items()
    )
    st.warning(f"Skipped worksheets without sales data columns: {skipped_details}")

if not valid_sheets:
    st.error("No worksheet contains valid sales rows. Check for Date, Product, Category, Region, Sales, Quantity, and Profit columns.")
    st.stop()

df = pd.concat(valid_sheets, ignore_index=True)

# ---------- Sidebar Filters ----------
st.sidebar.header("🔎 Filters")

min_date = df["Date"].min().date()
max_date = df["Date"].max().date()

regions = sorted(df["Region"].unique())
categories = sorted(df["Category"].unique())
products = sorted(df["Product"].unique())

filter_options = {
    "filter_regions": regions,
    "filter_categories": categories,
    "filter_products": products,
}
for key, options in filter_options.items():
    if key not in st.session_state:
        st.session_state[key] = list(options)
    else:
        st.session_state[key] = [
            value for value in st.session_state[key] if value in options
        ]

date_key = "filter_date_range"
current_date_range = st.session_state.get(date_key, (min_date, max_date))
if (
    not isinstance(current_date_range, (tuple, list))
    or len(current_date_range) != 2
    or current_date_range[0] < min_date
    or current_date_range[1] > max_date
):
    st.session_state[date_key] = (min_date, max_date)

date_range = st.sidebar.date_input(
    "Date Range",
    min_value=min_date,
    max_value=max_date,
    key=date_key,
)

if isinstance(date_range, tuple) and len(date_range) == 2:
    start_date, end_date = date_range
else:
    start_date, end_date = min_date, max_date

selected_regions = filter_dropdown("Region", regions, "filter_regions", "All regions")
selected_categories = filter_dropdown("Category", categories, "filter_categories", "All categories")
selected_products = filter_dropdown("Product", products, "filter_products", "All products")
st.sidebar.button(
    "↺ Clear all filters",
    use_container_width=True,
    on_click=reset_all_filters,
    args=(regions, categories, products, min_date, max_date),
)

filtered = df[
    (df["Date"].dt.date >= start_date) &
    (df["Date"].dt.date <= end_date) &
    (df["Region"].isin(selected_regions)) &
    (df["Category"].isin(selected_categories)) &
    (df["Product"].isin(selected_products))
].copy()

chart_action = st.session_state.get("chart_action", {})
if "Category" in chart_action:
    filtered = filtered[filtered["Category"] == chart_action["Category"]]
if "Region" in chart_action:
    filtered = filtered[filtered["Region"] == chart_action["Region"]]
if "Product" in chart_action:
    filtered = filtered[filtered["Product"] == chart_action["Product"]]
if "Month" in chart_action:
    selected_month = pd.to_datetime(chart_action["Month"])
    filtered = filtered[filtered["Date"].dt.to_period("M") == selected_month.to_period("M")]
if "Date" in chart_action:
    selected_day = pd.to_datetime(chart_action["Date"]).date()
    filtered = filtered[filtered["Date"].dt.date == selected_day]

if chart_action:
    action_description = ", ".join(
        f"{dimension}: {value}" for dimension, value in chart_action.items()
    )
    st.caption(f"Chart action filter — {action_description}")
    st.button("Clear chart selection", on_click=clear_chart_action)

if filtered.empty:
    st.warning("No data matches the selected filters.")
    st.stop()

# ---------- KPI ----------
total_sales = filtered["Sales"].sum()
total_profit = filtered["Profit"].sum()
total_orders = len(filtered)
total_quantity = filtered["Quantity"].sum()

c1, c2, c3, c4 = st.columns(4)

with c1:
    st.markdown(f"""
    <div class="kpi">
        <div class="kpi-label">💰 Total Sales</div>
        <div class="kpi-value">{money(total_sales)}</div>
    </div>
    """, unsafe_allow_html=True)

with c2:
    st.markdown(f"""
    <div class="kpi">
        <div class="kpi-label">📈 Total Profit</div>
        <div class="kpi-value">{money(total_profit)}</div>
    </div>
    """, unsafe_allow_html=True)

with c3:
    st.markdown(f"""
    <div class="kpi">
        <div class="kpi-label">🧾 Total Orders</div>
        <div class="kpi-value">{total_orders:,}</div>
    </div>
    """, unsafe_allow_html=True)

with c4:
    st.markdown(f"""
    <div class="kpi">
        <div class="kpi-label">📦 Total Quantity</div>
        <div class="kpi-value">{total_quantity:,.0f}</div>
    </div>
    """, unsafe_allow_html=True)

st.write("")

# ---------- Monthly Trend ----------
monthly = (
    filtered.assign(Month=filtered["Date"].dt.to_period("M").dt.to_timestamp())
    .groupby("Month", as_index=False)[["Sales", "Profit"]]
    .sum()
)
monthly["MonthLabel"] = monthly["Month"].dt.strftime("%Y-%m-%d")

st.markdown('<div class="section-title">Monthly Sales Trend</div>', unsafe_allow_html=True)

fig_trend = px.line(
    monthly,
    x="Month",
    y=["Sales", "Profit"],
    markers=True,
    custom_data=["MonthLabel"],
    labels={"value": "Amount", "Month": "Month", "variable": ""},
)
fig_trend.update_layout(
    margin=dict(l=10, r=75, t=20, b=10),
    legend_title_text="",
    plot_bgcolor="white",
    paper_bgcolor="white"
)
fig_trend.update_traces(selector={"name": "Sales"}, line={"color": "#4f7df3"})
fig_trend.update_traces(selector={"name": "Profit"}, line={"color": "#f28e2b"})
last_month = monthly.iloc[-1]
fig_trend.add_annotation(
    x=last_month["Month"], y=last_month["Sales"], text="Sales",
    showarrow=False, xshift=28, font={"color": "#4f7df3", "size": 12}
)
fig_trend.add_annotation(
    x=last_month["Month"], y=last_month["Profit"], text="Profit",
    showarrow=False, xshift=28, yshift=-12, font={"color": "#f28e2b", "size": 12}
)
show_chart(fig_trend, "monthly_trend_chart", ["Month"])

# ---------- Category / Region ----------
left, right = st.columns(2)

with left:
    st.markdown('<div class="section-title">Sales by Category</div>', unsafe_allow_html=True)
    category_sales = filtered.groupby("Category", as_index=False)["Sales"].sum()
    fig_cat = px.pie(
        category_sales,
        names="Category",
        values="Sales",
        hole=0.52,
        custom_data=["Category"]
    )
    fig_cat.update_layout(margin=dict(l=10, r=10, t=10, b=10))
    show_chart(fig_cat, "category_sales_chart", ["Category"])

with right:
    st.markdown('<div class="section-title">Sales by Region</div>', unsafe_allow_html=True)
    region_sales = (
        filtered.groupby("Region", as_index=False)[["Sales", "Profit"]]
        .sum()
        .sort_values("Sales", ascending=False)
    )
    fig_region = make_subplots(specs=[[{"secondary_y": True}]])
    region_customdata = region_sales[["Region"]].to_numpy()
    fig_region.add_trace(
        go.Bar(
            x=region_sales["Region"],
            y=region_sales["Sales"],
            name="Sales",
            text=region_sales["Sales"],
            texttemplate="%{text:.2s}",
            textposition="outside",
            customdata=region_customdata,
            marker_color="#4f7df3",
        ),
        secondary_y=False,
    )
    fig_region.add_trace(
        go.Scatter(
            x=region_sales["Region"],
            y=region_sales["Profit"],
            name="Profit",
            mode="lines+markers",
            customdata=region_customdata,
            line={"color": "#f28e2b", "width": 3},
            marker={"size": 9},
        ),
        secondary_y=True,
    )
    fig_region.update_layout(
        legend_title_text="",
        margin=dict(l=10, r=10, t=10, b=10),
        plot_bgcolor="white",
        paper_bgcolor="white",
        hovermode="x unified",
    )
    fig_region.update_xaxes(title_text="Region")
    fig_region.update_yaxes(title_text="Sales", secondary_y=False, rangemode="tozero")
    fig_region.update_yaxes(title_text="Profit", secondary_y=True)
    show_chart(fig_region, "region_sales_chart", ["Region"])

# ---------- Profit / Top Products ----------
left, right = st.columns(2)

with left:
    st.markdown('<div class="section-title">Profit by Category</div>', unsafe_allow_html=True)
    profit_category = (
        filtered.groupby("Category", as_index=False)["Profit"]
        .sum()
        .sort_values("Profit", ascending=False)
    )
    fig_profit = px.bar(
        profit_category,
        x="Category",
        y="Profit",
        text_auto=".2s",
        custom_data=["Category"]
    )
    fig_profit.update_layout(
        margin=dict(l=10, r=10, t=10, b=10),
        plot_bgcolor="white",
        paper_bgcolor="white"
    )
    show_chart(fig_profit, "category_profit_chart", ["Category"])

with right:
    st.markdown('<div class="section-title">Top 10 Products by Sales</div>', unsafe_allow_html=True)
    top_products = (
        filtered.groupby("Product", as_index=False)["Sales"]
        .sum()
        .sort_values("Sales", ascending=False)
        .head(10)
        .sort_values("Sales", ascending=True)
    )
    fig_products = px.bar(
        top_products,
        x="Sales",
        y="Product",
        orientation="h",
        text_auto=".2s",
        custom_data=["Product"]
    )
    fig_products.update_layout(
        margin=dict(l=10, r=10, t=10, b=10),
        plot_bgcolor="white",
        paper_bgcolor="white"
    )
    show_chart(fig_products, "top_products_chart", ["Product"])

# ---------- Sales vs Profit ----------
st.markdown('<div class="section-title">Sales vs Profit</div>', unsafe_allow_html=True)

scatter_data = filtered.copy()
scatter_data["ProfitSize"] = scatter_data["Profit"].abs().clip(lower=0.01)
scatter = px.scatter(
    scatter_data,
    x="Quantity",
    y="Sales",
    size="ProfitSize",
    color="Category",
    hover_data=["Product", "Region", "Profit"],
    custom_data=["Product", "Category", "Region", "Date"],
)
scatter.update_layout(
    margin=dict(l=10, r=10, t=10, b=10),
    plot_bgcolor="white",
    paper_bgcolor="white"
)
show_chart(scatter, "sales_profit_chart", ["Product", "Category", "Region", "Date"])

# ---------- Recent Data ----------
st.markdown('<div class="section-title">Recent Sales Data</div>', unsafe_allow_html=True)

recent = filtered.sort_values("Date", ascending=False).head(15).copy()
recent["Date"] = recent["Date"].dt.strftime("%Y-%m-%d")

st.dataframe(
    recent[REQUIRED_COLUMNS],
    use_container_width=True,
    hide_index=True
)

# ---------- Download filtered data ----------
csv = filtered.to_csv(index=False).encode("utf-8")
st.download_button(
    "⬇️ Download Filtered Data",
    data=csv,
    file_name="filtered_sales_data.csv",
    mime="text/csv"
)

st.caption("Sales Dashboard • Built with Python, Streamlit, Pandas and Plotly")
