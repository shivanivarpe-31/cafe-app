import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useMenu } from "../context/MenuContext";
import {
  Plus,
  Search,
  X,
  Save,
  Package,
  RefreshCw,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Keyboard,
} from "lucide-react";
import Navbar from "../components/navbar";
import axios from "axios";
import { showSuccess, showError, showWarning } from "../utils/toast";
import { DEFAULT_FORM_STATE } from "../utils/menuConstants";
import {
  validateMenuForm,
  filterMenuItems,
  separateActiveItems,
  getAllCategories,
  getLowStockIngredients,
} from "../utils/menuHelpers";
import { useDebounce } from "../hooks/useDebounce";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import {
  MenuItemCard,
  MenuItemRow,
  MenuTableSkeleton,
} from "../components/menu/MenuItemCard";
import { EmptyState } from "../components/EmptyState";

const MenuPage = () => {
  // Get lightweight menu functions from context
  const { addItem, updateItem, deleteItem } = useMenu();

  // MenuPage needs detailed menu data with inventory & ingredients
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM_STATE);

  // View & Sort options
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem("menuViewMode") || "table";
  });
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Loading states for async operations
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Refs for cleanup and focus management
  const abortControllerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Debounced search term for performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch detailed menu for management (includes inventory & ingredients)
  const fetchMenu = useCallback(async (isRefresh = false) => {
    // Create new abort controller for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await axios.get("/api/menu/items/detailed", {
        signal: abortControllerRef.current.signal,
      });
      setMenuItems(res.data.data || res.data || []);
    } catch (err) {
      if (err.name === "AbortError" || err.name === "CanceledError") {
        return;
      }
      console.error("Failed to fetch menu:", err);
      showError("Failed to load menu items");
      setMenuItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load of detailed menu
  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Wrapped fetchCategories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get("/api/menu/categories");
      setCategories(res.data);
      if (res.data.length > 0) {
        setForm((prev) => ({
          ...prev,
          categoryId: prev.categoryId || res.data[0].id,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, []);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const validation = validateMenuForm(form);
    if (!validation.valid) {
      showWarning(validation.errors.join(", "));
      return;
    }

    setSubmitting(true);
    try {
      const itemData = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        categoryId: parseInt(form.categoryId),
      };

      if (editMode) {
        await updateItem(editingId, itemData);
        showSuccess("Item updated successfully!");
      } else {
        await addItem(itemData);
        showSuccess("Item added successfully!");
      }

      cancelForm();
      fetchMenu(); // Refresh detailed menu data
    } catch (err) {
      showError("Failed: " + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      categoryId: item.categoryId,
    });
    setEditingId(item.id);
    setEditMode(true);
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setDeleting(id);
    try {
      await deleteItem(id);
      showSuccess(`"${name}" deleted successfully!`);
      fetchMenu(); // Refresh detailed menu data
    } catch (err) {
      showError("Delete failed: " + (err.response?.data?.error || err.message));
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (item) => {
    const action = item.isActive !== false ? "deactivate" : "activate";
    const confirmation = window.confirm(
      `Are you sure you want to ${action} "${item.name}"?`,
    );

    if (!confirmation) return;

    setToggling(item.id);
    try {
      await updateItem(item.id, { isActive: !item.isActive });
      showSuccess(`"${item.name}" ${action}d successfully!`);
      fetchMenu(); // Refresh detailed menu data
    } catch (err) {
      showError(`Failed to ${action} item`);
    } finally {
      setToggling(null);
    }
  };

  // Handle view mode change with persistence
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem("menuViewMode", mode);
  };

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const cancelForm = () => {
    setForm({
      ...DEFAULT_FORM_STATE,
      categoryId: categories[0]?.id || DEFAULT_FORM_STATE.categoryId,
    });
    setShowForm(false);
    setEditMode(false);
    setEditingId(null);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "/": () => searchInputRef.current?.focus(),
    n: () => !showForm && setShowForm(true),
    escape: () => {
      if (showForm) cancelForm();
      if (showFilters) setShowFilters(false);
      if (showKeyboardHelp) setShowKeyboardHelp(false);
    },
    "?": () => setShowKeyboardHelp((prev) => !prev),
    g: () => handleViewModeChange("grid"),
    t: () => handleViewModeChange("table"),
    r: () => !refreshing && fetchMenu(true),
  });

  // Memoize category list
  const allCategories = useMemo(() => {
    return getAllCategories(categories);
  }, [categories]);

  // Memoize filtered items with debounced search
  const filteredItems = useMemo(() => {
    return filterMenuItems(menuItems, debouncedSearchTerm, selectedCategory);
  }, [menuItems, debouncedSearchTerm, selectedCategory]);

  // Memoize sorted items
  const sortedItems = useMemo(() => {
    if (!sortConfig.key) return filteredItems;

    return [...filteredItems].sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "price":
          aVal = parseFloat(a.price);
          bVal = parseFloat(b.price);
          break;
        case "stock":
          aVal = getLowStockIngredients(a).length;
          bVal = getLowStockIngredients(b).length;
          break;
        case "category":
          aVal = a.category?.name?.toLowerCase() || "";
          bVal = b.category?.name?.toLowerCase() || "";
          break;
        case "status":
          aVal = a.isActive !== false ? 1 : 0;
          bVal = b.isActive !== false ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortConfig]);

  // Memoize active/inactive separation
  const { activeItems, inactiveItems } = useMemo(() => {
    return separateActiveItems(sortedItems);
  }, [sortedItems]);

  // Sort icon component
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-red-500" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-red-500" />
    );
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        {/* Skeleton header */}
        <div className="bg-white border-b border-gray-200 py-6">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-7 bg-gray-200 rounded w-48 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 bg-gray-200 rounded-xl animate-pulse"></div>
                <div className="h-11 w-32 bg-gray-200 rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
        {/* Skeleton content */}
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <div className="flex gap-4">
              <div className="h-11 bg-gray-200 rounded-xl flex-1 animate-pulse"></div>
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-11 w-20 bg-gray-200 rounded-xl animate-pulse"
                  ></div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden p-6">
            <MenuTableSkeleton rows={6} />
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      <Navbar />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-gradient-to-r from-red-500 to-orange-500 w-8 h-8 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </span>
                Menu Management
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  {activeItems.length} active
                </span>
                <span className="mx-2">•</span>
                <span className="text-gray-400">
                  {inactiveItems.length} inactive
                </span>
                <span className="mx-2">•</span>
                <span>{categories.length} categories</span>
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* View toggle */}
              <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange("table")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "table"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  title="Table view (T)"
                  aria-label="Switch to table view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleViewModeChange("grid")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  title="Grid view (G)"
                  aria-label="Switch to grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              {/* Keyboard shortcuts hint */}
              <button
                onClick={() => setShowKeyboardHelp(true)}
                className="hidden sm:flex p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="w-4 h-4" />
              </button>

              <button
                onClick={() => fetchMenu(true)}
                disabled={refreshing}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all disabled:opacity-50"
                title="Refresh (R)"
                aria-label="Refresh menu items"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>

              <button
                onClick={() => setShowForm(!showForm)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all ${
                  showForm
                    ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    : "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                }`}
              >
                {showForm ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                <span>{showForm ? "Cancel" : "Add Item"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden animate-in slide-in-from-top-2 duration-300">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5" />
                {editMode ? "Edit Menu Item" : "Add New Item"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    placeholder="e.g., Cappuccino"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
                    required
                    autoFocus={!editMode}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                      }
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm({ ...form, categoryId: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm bg-white transition-all cursor-pointer"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Description{" "}
                    <span className="text-gray-400 font-normal">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    placeholder="Brief description of the item..."
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm resize-none transition-all"
                    rows="2"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={submitting}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-2.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{editMode ? "Updating..." : "Adding..."}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editMode ? "Update Item" : "Add to Menu"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search menu items... (press / to focus)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category filters & Sort */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Mobile view toggle */}
              <div className="flex sm:hidden items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange("table")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "table"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleViewModeChange("grid")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              {/* Filters toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  showFilters || selectedCategory !== "All"
                    ? "bg-red-50 text-red-600 border border-red-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {selectedCategory !== "All" && (
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() =>
                    handleSort(
                      sortConfig.key === "name"
                        ? "price"
                        : sortConfig.key === "price"
                        ? "stock"
                        : "name",
                    )
                  }
                  className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-all"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="hidden sm:inline capitalize">
                    {sortConfig.key}
                  </span>
                  {sortConfig.direction === "asc" ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Expandable category filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 font-medium">
                  Category:
                </span>
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === cat
                        ? "bg-red-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {sortedItems.length} of {menuItems.length} items
            {debouncedSearchTerm && ` matching "${debouncedSearchTerm}"`}
          </span>
          {selectedCategory !== "All" && (
            <button
              onClick={() => setSelectedCategory("All")}
              className="text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear filter
            </button>
          )}
        </div>

        {/* Menu Items - Grid or Table View */}
        {viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedItems.length > 0 ? (
              sortedItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                  isDeleting={deleting === item.id}
                  isToggling={toggling === item.id}
                />
              ))
            ) : (
              <div className="col-span-full">
                <EmptyState
                  icon={Package}
                  title="No items found"
                  message={
                    searchTerm
                      ? "Try adjusting your search or filters"
                      : "Get started by adding your first menu item"
                  }
                  action={
                    !searchTerm && (
                      <button
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                      >
                        Add First Item
                      </button>
                    )
                  }
                />
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <span className="flex items-center gap-2">
                        Item
                        <SortIcon columnKey="name" />
                      </span>
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("category")}
                    >
                      <span className="flex items-center gap-2">
                        Category
                        <SortIcon columnKey="category" />
                      </span>
                    </th>
                    <th
                      className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("price")}
                    >
                      <span className="flex items-center gap-2 justify-end">
                        Price
                        <SortIcon columnKey="price" />
                      </span>
                    </th>
                    <th
                      className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("stock")}
                    >
                      <span className="flex items-center gap-2 justify-center">
                        Ingredients
                        <SortIcon columnKey="stock" />
                      </span>
                    </th>
                    <th
                      className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("status")}
                    >
                      <span className="flex items-center gap-2 justify-center">
                        Status
                        <SortIcon columnKey="status" />
                      </span>
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedItems.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleActive={handleToggleActive}
                      isDeleting={deleting === item.id}
                      isToggling={toggling === item.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {sortedItems.length === 0 && (
              <EmptyState
                icon={Package}
                title="No items found"
                message={
                  searchTerm
                    ? "Try adjusting your search or filters"
                    : "Get started by adding your first menu item"
                }
                action={
                  !searchTerm && (
                    <button
                      onClick={() => setShowForm(true)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                    >
                      Add First Item
                    </button>
                  )
                }
              />
            )}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowKeyboardHelp(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-shortcuts-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3
                id="menu-shortcuts-title"
                className="text-lg font-bold text-gray-900 flex items-center gap-2"
              >
                <Keyboard className="w-5 h-5 text-gray-500" />
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                aria-label="Close modal"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { key: "/", desc: "Focus search" },
                { key: "N", desc: "Add new item" },
                { key: "G", desc: "Grid view" },
                { key: "T", desc: "Table view" },
                { key: "R", desc: "Refresh menu" },
                { key: "?", desc: "Toggle shortcuts help" },
                { key: "Esc", desc: "Close modal / Cancel" },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{desc}</span>
                  <kbd className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-xs font-mono text-gray-700">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPage;
