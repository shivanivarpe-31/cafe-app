/**
 * Zomato API Client
 * Handles all outbound API calls to Zomato's Online Ordering API v1
 * 
 * Zomato API Base: https://api.zomato.com (or partner-specific URL)
 * All endpoints under: /online-ordering/v1/
 */

const { prisma } = require('../../prisma');
const { logIntegrationEvent } = require('../../utils/integrationLogger');
const logger = require('../../utils/logger');

const DEFAULT_BASE_URL = 'https://api.zomato.com';

/**
 * Get Zomato config from DB
 */
async function getZomatoConfig() {
    const config = await prisma.platformConfig.findUnique({
        where: { platform: 'ZOMATO' }
    });

    if (!config || !config.isEnabled) {
        throw new Error('Zomato integration is not enabled');
    }

    if (!config.apiKey) {
        throw new Error('Zomato API key is not configured');
    }

    // Parse settings JSON for base URL override
    let settings = {};
    if (config.settings) {
        try { settings = JSON.parse(config.settings); } catch { /* use defaults */ }
    }

    return {
        apiKey: config.apiKey,
        restaurantId: config.restaurantId,
        baseUrl: settings.baseUrl || DEFAULT_BASE_URL,
        autoAcceptOrders: config.autoAcceptOrders,
        defaultPrepTime: config.defaultPrepTime,
        statusUpdateEnabled: config.statusUpdateEnabled
    };
}

/**
 * Make authenticated API call to Zomato
 */
async function zomatoApiCall(endpoint, method, body = null) {
    const config = await getZomatoConfig();
    const url = `${config.baseUrl}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': config.apiKey
    };

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const startTime = Date.now();
    let responseData, statusCode;

    try {
        const response = await fetch(url, options);
        statusCode = response.status;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        // Log the API call
        await logIntegrationEvent({
            platform: 'ZOMATO',
            eventType: 'API_CALL',
            direction: 'OUTBOUND',
            endpoint,
            requestBody: body ? JSON.stringify(body) : null,
            responseBody: typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
            statusCode,
            success: response.ok,
            errorMessage: response.ok ? null : (responseData?.message || `HTTP ${statusCode}`)
        }).catch(() => { }); // Don't fail the main operation if logging fails

        if (!response.ok) {
            const errMsg = responseData?.message || responseData?.error || `HTTP ${statusCode}`;
            throw new Error(`Zomato API error: ${errMsg}`);
        }

        logger.info(`[ZOMATO API] ${method} ${endpoint} → ${statusCode} (${Date.now() - startTime}ms)`);
        return responseData;

    } catch (error) {
        logger.error(`[ZOMATO API] ${method} ${endpoint} failed`, {
            error: error.message,
            statusCode,
            duration: `${Date.now() - startTime}ms`
        });
        throw error;
    }
}

// ─── Order Management APIs ────────────────────────────────────────────

/**
 * Confirm an order relayed from Zomato
 * POST /online-ordering/v1/order/confirm
 */
async function confirmOrder(orderId, prepTime) {
    const config = await getZomatoConfig();
    return zomatoApiCall('/online-ordering/v1/order/confirm', 'POST', {
        order_id: orderId,
        preparation_time: prepTime || config.defaultPrepTime
    });
}

/**
 * Reject an order relayed from Zomato
 * POST /online-ordering/v1/order/reject
 */
async function rejectOrder(orderId, reason) {
    return zomatoApiCall('/online-ordering/v1/order/reject', 'POST', {
        order_id: orderId,
        reason: reason || 'Restaurant unable to fulfill order'
    });
}

/**
 * Mark an order as ready for pickup
 * POST /online-ordering/v1/order/ready
 * @param {string} orderId - Zomato order ID
 * @param {boolean|null} itemCheckList - Whether the item checklist was verified (null if not applicable)
 */
async function markOrderReady(orderId, itemCheckList = null) {
    const body = { order_id: orderId };
    if (itemCheckList !== null && itemCheckList !== undefined) {
        body.item_check_list = itemCheckList;
    }
    return zomatoApiCall('/online-ordering/v1/order/ready', 'POST', body);
}

/**
 * Mark an order as picked up by delivery partner
 * POST /online-ordering/v1/order/pickedup
 */
async function markOrderPickedUp(orderId) {
    return zomatoApiCall('/online-ordering/v1/order/pickedup', 'POST', {
        order_id: orderId
    });
}

/**
 * Assign a delivery partner to an order
 * POST /online-ordering/v1/order/assigned
 */
async function assignDeliveryPartner(orderId, partnerDetails) {
    return zomatoApiCall('/online-ordering/v1/order/assigned', 'POST', {
        order_id: orderId,
        ...partnerDetails
    });
}

/**
 * Mark an order as delivered
 * POST /online-ordering/v1/order/delivered
 */
async function markOrderDelivered(orderId) {
    return zomatoApiCall('/online-ordering/v1/order/delivered', 'POST', {
        order_id: orderId
    });
}

// ─── Complaints & Cancellations ─────────────────────────────────────

/**
 * Update complaint for an order
 * POST /online-ordering/v1/complaints/update
 */
async function updateComplaint(orderId, complaintData) {
    return zomatoApiCall('/online-ordering/v1/complaints/update', 'POST', {
        order_id: orderId,
        ...complaintData
    });
}

/**
 * Update Merchant Agreed Cancellation (MAC)
 * POST /online-ordering/v1/mac/update
 */
async function updateMerchantAgreedCancellation(orderId, accepted, reason) {
    return zomatoApiCall('/online-ordering/v1/mac/update', 'POST', {
        order_id: orderId,
        accepted: accepted,
        reason: reason || undefined
    });
}

// ─── Order Info ────────────────────────────────────────────────────

/**
 * Get masked contact details of customer/delivery partner
 * GET /online-ordering/v1/order/get-contact-details
 */
async function getContactDetails(orderId) {
    return zomatoApiCall(
        `/online-ordering/v1/order/get-contact-details?order_id=${encodeURIComponent(orderId)}`,
        'GET'
    );
}

/**
 * Get order rating
 * GET /online-ordering/v1/order-analytics/get_orders_rating
 */
async function getOrderRating(orderId) {
    return zomatoApiCall(
        `/online-ordering/v1/order-analytics/get_orders_rating?order_id=${encodeURIComponent(orderId)}`,
        'GET'
    );
}

// ─── Helper: Notify Zomato of status change ─────────────────────────

/**
 * Called whenever a delivery status changes locally for a Zomato order.
 * Sends the corresponding outbound API call to Zomato.
 */
async function notifyZomatoStatusChange(platformOrderId, newStatus, extra = {}) {
    try {
        const config = await getZomatoConfig();
        if (!config.statusUpdateEnabled) {
            logger.info('[ZOMATO API] Status updates disabled, skipping notification');
            return { skipped: true };
        }

        switch (newStatus) {
            case 'CONFIRMED':
            case 'PREPARING':
                return await confirmOrder(platformOrderId, extra.prepTime);
            case 'READY_FOR_PICKUP':
                return await markOrderReady(platformOrderId, extra.itemCheckList ?? null);
            case 'RIDER_ASSIGNED':
                // Self-logistics: tell Zomato we assigned our own delivery partner
                return await assignDeliveryPartner(platformOrderId, {
                    name: extra.deliveryPartnerName || 'Restaurant Delivery',
                    phone: extra.deliveryPartnerPhone || ''
                });
            case 'OUT_FOR_DELIVERY':
                return await markOrderPickedUp(platformOrderId);
            case 'DELIVERED':
                return await markOrderDelivered(platformOrderId);
            case 'CANCELLED':
                if (extra.rejectionReason) {
                    return await rejectOrder(platformOrderId, extra.rejectionReason);
                }
                return await rejectOrder(platformOrderId, 'Order cancelled by restaurant');
            default:
                logger.info(`[ZOMATO API] No outbound call needed for status: ${newStatus}`);
                return { skipped: true };
        }
    } catch (error) {
        // Log but don't fail the local status update 
        logger.error('[ZOMATO API] Failed to notify Zomato of status change', {
            platformOrderId,
            newStatus,
            error: error.message
        });
        return { error: error.message };
    }
}

// ─── Menu Management APIs (v3) ──────────────────────────────────────

/**
 * Push full menu to Zomato
 * POST /online-ordering/v3/menu/add
 * 
 * Transforms local menu (categories + items + modifications) into
 * Zomato's expected menu format and sends it.
 */
async function addMenu(menuPayload) {
    return zomatoApiCall('/online-ordering/v3/menu/add', 'POST', menuPayload);
}

/**
 * Fetch the current menu on Zomato for this outlet
 * GET /online-ordering/v3/menu/get
 */
async function getMenu() {
    const config = await getZomatoConfig();
    return zomatoApiCall(
        `/online-ordering/v3/menu/get?restaurant_id=${encodeURIComponent(config.restaurantId)}`,
        'GET'
    );
}

/**
 * Toggle stock status for items on Zomato
 * POST /online-ordering/v3/menu/item/stock
 * 
 * @param {Array} items - Array of { item_id, in_stock: true/false }
 */
async function updateStockStatus(items) {
    const config = await getZomatoConfig();
    return zomatoApiCall('/online-ordering/v3/menu/item/stock', 'POST', {
        restaurant_id: config.restaurantId,
        items
    });
}

/**
 * Build Zomato v3 menu payload from our local DB.
 * 
 * Zomato's menu structure:
 *   { categories, catalogues, modifierGroups }
 * 
 * - categories[] → each has subCategories[] → each has entities[] (vendorEntityId refs to catalogues)
 * - catalogues[] → each has variants[] which hold prices, plus modifierGroups[] refs
 * - modifierGroups[] → each has min/max + variants[] (refs to catalogues acting as add-ons)
 * 
 * vendorEntityId is our internal DB id prefixed by type, e.g. "cat-1", "item-42", "mod-7"
 * 
 * Key Zomato rules enforced:
 *   - Every catalogue needs exactly 1 dietary tag (veg/non-veg/egg)
 *   - Root catalogues (in subCategory entities) need GST classification tag
 *   - Catalogues must have at least 1 variant with prices
 *   - Category name ≤ 45 chars, catalogue name ≤ 70 chars, description ≤ 500 chars
 *   - inStock on new entities only; existing items use menu/item/stock API
 *   - This is a FULL SNAPSHOT — only entities sent will be retained
 */
async function buildMenuPayload() {
    // For preview purposes, allow building even without full Zomato config
    let config;
    try {
        config = await getZomatoConfig();
    } catch {
        // Fallback: read raw config without validation
        const rawConfig = await prisma.platformConfig.findUnique({ where: { platform: 'ZOMATO' } });
        config = {
            apiKey: rawConfig?.apiKey || '',
            restaurantId: rawConfig?.restaurantId || 'PREVIEW',
            settings: rawConfig?.settings || null
        };
    }

    // Fetch all active categories with their active items
    const categories = await prisma.category.findMany({
        include: {
            menuItems: {
                where: { isActive: true },
                include: {
                    platformMappings: {
                        where: { platform: 'ZOMATO', isActive: true }
                    },
                    inventory: true
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    // Fetch all active modifications grouped by their category (modifier group)
    const modifications = await prisma.modification.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    // Parse settings for defaults (dietary, GST)
    let settings = {};
    try { if (config.settings) settings = JSON.parse(config.settings); } catch { /* defaults */ }
    const defaultDietaryTag = settings.defaultDietaryTag || 'veg'; // 'veg' | 'non-veg' | 'egg'
    const defaultGstTag = settings.defaultGstTag || 'goods';       // 'goods' | 'services'
    const defaultGstPercent = settings.defaultGstPercent ?? 5;
    const services = settings.services || ['delivery']; // Zomato service types

    // ── Build modifier groups (add-on groups) ──
    // Group modifications by their category string
    const modGroupMap = {};
    for (const mod of modifications) {
        const groupName = mod.category || 'Add-ons';
        if (!modGroupMap[groupName]) {
            modGroupMap[groupName] = { name: groupName, mods: [] };
        }
        modGroupMap[groupName].mods.push(mod);
    }

    // Build catalogues for add-on items (non-root catalogues: no tags, no taxGroups, no charges)
    const addonCatalogues = [];
    const modifierGroups = [];

    for (const [groupName, group] of Object.entries(modGroupMap)) {
        const mgVendorId = `mg-${groupName.replace(/\s+/g, '-').toLowerCase()}`;
        const mgVariants = [];

        for (const mod of group.mods) {
            const addonVendorId = `addon-${mod.id}`;
            const variantVendorId = `addon-var-${mod.id}`;

            // Add-on catalogue (non-root: no properties, no taxGroups, no charges)
            addonCatalogues.push({
                vendorEntityId: addonVendorId,
                name: mod.name.substring(0, 70),
                inStock: true,
                variants: [{
                    vendorEntityId: variantVendorId,
                    prices: services.map(svc => ({
                        service: svc,
                        value: parseFloat(mod.price)
                    })),
                    propertyValues: []
                }]
                // No tags, no taxGroups, no charges for non-root catalogues
            });

            // Reference this addon catalogue's variant in the modifier group
            mgVariants.push({
                vendorEntityId: variantVendorId,
                catalogueVendorEntityId: addonVendorId
            });
        }

        modifierGroups.push({
            vendorEntityId: mgVendorId,
            name: groupName.substring(0, 70),
            min: 0,  // Optional add-ons by default
            max: mgVariants.length,
            maxSelectionsPerItem: 1,
            variants: mgVariants
        });
    }

    // ── Build root catalogues (menu items) ──
    const rootCatalogues = [];
    const zomatoCategories = [];

    for (const cat of categories) {
        const activeItems = cat.menuItems.filter(item => item.isActive);
        if (activeItems.length === 0) continue;

        const catVendorId = `cat-${cat.id}`;
        const subCatVendorId = `subcat-${cat.id}`;
        const entityRefs = [];

        for (const item of activeItems) {
            const mapping = item.platformMappings[0]; // ZOMATO mapping
            const itemVendorId = mapping?.platformItemId || `item-${item.id}`;
            const variantVendorId = mapping?.platformSKU || `var-${item.id}`;

            const inStock = item.inventory
                ? item.inventory.quantity > 0 && !item.inventory.lowStock
                : true;

            // Determine dietary tag from item name/description heuristics
            const dietaryTag = detectDietaryTag(item.name, item.description, defaultDietaryTag);

            // Build variant (every catalogue needs at least 1)
            const variant = {
                vendorEntityId: variantVendorId,
                prices: services.map(svc => ({
                    service: svc,
                    value: parseFloat(mapping?.platformPrice || item.price)
                })),
                propertyValues: [],
                // Attach modifier groups to this variant (all add-on groups available)
                modifierGroups: modifierGroups.map(mg => ({
                    vendorEntityId: mg.vendorEntityId
                }))
            };

            // Build root catalogue
            const catalogue = {
                vendorEntityId: itemVendorId,
                name: (mapping?.platformItemName || item.name).substring(0, 70),
                description: (item.description || '').substring(0, 500) || undefined,
                inStock,
                variants: [variant],
                properties: [],
                tags: [
                    // Dietary tag (mandatory for all root catalogues)
                    {
                        tagGroup: 'Dietary',
                        tag: dietaryTag
                    },
                    // GST classification (mandatory for India)
                    {
                        tagGroup: 'GSTClassification',
                        tag: defaultGstTag
                    }
                ],
                // Tax group for GST
                taxGroups: [{
                    name: 'GST',
                    percentage: defaultGstPercent
                }]
            };

            // Remove empty description
            if (!catalogue.description) delete catalogue.description;

            rootCatalogues.push(catalogue);
            entityRefs.push({ vendorEntityId: itemVendorId });
        }

        // Build category with subcategory
        zomatoCategories.push({
            vendorEntityId: catVendorId,
            name: cat.name.substring(0, 45),
            subCategories: [{
                vendorEntityId: subCatVendorId,
                name: cat.name.substring(0, 45),
                entities: entityRefs
            }]
        });
    }

    // All catalogues = root catalogues + addon catalogues
    const allCatalogues = [...rootCatalogues, ...addonCatalogues];

    return {
        restaurant_id: config.restaurantId,
        categories: zomatoCategories,
        catalogues: allCatalogues,
        modifierGroups: modifierGroups.length > 0 ? modifierGroups : undefined
    };
}

/**
 * Detect dietary tag from item name and description.
 * Zomato auto-detects non-veg/egg from keywords, so we mirror that logic.
 */
function detectDietaryTag(name, description, fallback) {
    const text = `${name} ${description || ''}`.toLowerCase();

    // Non-veg keywords
    const nonVegKeywords = [
        'chicken', 'mutton', 'lamb', 'fish', 'prawn', 'shrimp', 'crab',
        'lobster', 'pork', 'bacon', 'ham', 'beef', 'steak', 'meat',
        'keema', 'seekh', 'tandoori chicken', 'butter chicken', 'biryani chicken',
        'non-veg', 'nonveg', 'non veg'
    ];

    // Egg keywords
    const eggKeywords = [
        'egg', 'eggs', 'omelette', 'omelet', 'anda', 'scrambled egg',
        'boiled egg', 'egg curry', 'egg fried'
    ];

    for (const kw of nonVegKeywords) {
        if (text.includes(kw)) return 'non-veg';
    }

    for (const kw of eggKeywords) {
        if (text.includes(kw)) return 'egg';
    }

    return fallback;
}

/**
 * Validate menu payload before sending to Zomato.
 * Returns array of validation errors (empty = valid).
 */
function validateMenuPayload(payload) {
    const errors = [];

    // Track vendorEntityId uniqueness per entity type
    const seenIds = {
        categories: new Set(),
        subCategories: new Set(),
        catalogues: new Set(),
        variants: new Set(),
        modifierGroups: new Set()
    };

    function checkUnique(type, id, context) {
        if (!id) {
            errors.push(`${context}: vendorEntityId is empty`);
            return;
        }
        if (seenIds[type].has(id)) {
            errors.push(`${context}: duplicate vendorEntityId '${id}' in ${type}`);
        }
        seenIds[type].add(id);
    }

    // Validate categories
    if (!payload.categories || payload.categories.length === 0) {
        errors.push('Menu must have at least one category');
    }

    for (const cat of (payload.categories || [])) {
        checkUnique('categories', cat.vendorEntityId, `Category '${cat.name}'`);

        if (!cat.name || !/[a-zA-Z]/.test(cat.name)) {
            errors.push(`Category '${cat.name || '(empty)'}': name must contain at least one letter`);
        }
        if (cat.name && cat.name.length > 45) {
            errors.push(`Category '${cat.name}': name exceeds 45 characters`);
        }
        if (!cat.subCategories || cat.subCategories.length === 0) {
            errors.push(`Category '${cat.name}': subCategories must not be empty`);
        }

        for (const sub of (cat.subCategories || [])) {
            checkUnique('subCategories', sub.vendorEntityId, `SubCategory '${sub.name}'`);
            if (!sub.entities || sub.entities.length === 0) {
                errors.push(`SubCategory '${sub.name}' in '${cat.name}': entities must not be empty`);
            }
            // Check all entity refs exist in catalogues
            for (const ent of (sub.entities || [])) {
                const found = (payload.catalogues || []).some(c => c.vendorEntityId === ent.vendorEntityId);
                if (!found) {
                    errors.push(`SubCategory '${sub.name}': entity ref '${ent.vendorEntityId}' not found in catalogues`);
                }
            }

            // No duplicate catalogue names in same category
            const namesInCat = {};
            for (const ent of (sub.entities || [])) {
                const catalogue = (payload.catalogues || []).find(c => c.vendorEntityId === ent.vendorEntityId);
                if (catalogue) {
                    const alphaName = catalogue.name.replace(/[^a-zA-Z]/g, '').toLowerCase();
                    if (namesInCat[alphaName]) {
                        errors.push(`Category '${cat.name}': duplicate catalogue name '${catalogue.name}'`);
                    }
                    namesInCat[alphaName] = true;
                }
            }
        }
    }

    // Validate catalogues
    for (const cat of (payload.catalogues || [])) {
        checkUnique('catalogues', cat.vendorEntityId, `Catalogue '${cat.name}'`);

        if (!cat.name || !/[a-zA-Z]/.test(cat.name)) {
            errors.push(`Catalogue '${cat.vendorEntityId}': name must contain at least one letter`);
        }
        if (cat.name && cat.name.length > 70) {
            errors.push(`Catalogue '${cat.name}': name exceeds 70 characters`);
        }
        if (cat.description && cat.description.length > 500) {
            errors.push(`Catalogue '${cat.name}': description exceeds 500 characters`);
        }
        if (cat.description && cat.description.length > 0 && cat.description.length < 4) {
            errors.push(`Catalogue '${cat.name}': description must be empty or at least 4 characters`);
        }
        if (cat.description && cat.description.toLowerCase() === cat.name.toLowerCase()) {
            errors.push(`Catalogue '${cat.name}': description should not be equivalent to the item name`);
        }
        if (!cat.variants || cat.variants.length === 0) {
            errors.push(`Catalogue '${cat.name}': variants must not be empty`);
        }

        // Check root catalogues have tags
        const isRoot = (payload.categories || []).some(c =>
            (c.subCategories || []).some(s =>
                (s.entities || []).some(e => e.vendorEntityId === cat.vendorEntityId)
            )
        );

        if (isRoot) {
            const hasDietary = (cat.tags || []).some(t => t.tagGroup === 'Dietary');
            if (!hasDietary) {
                errors.push(`Catalogue '${cat.name}': root catalogue must have a Dietary tag`);
            }
            const hasGst = (cat.tags || []).some(t => t.tagGroup === 'GSTClassification');
            if (!hasGst) {
                errors.push(`Catalogue '${cat.name}': root catalogue must have a GSTClassification tag`);
            }
        }

        // Validate variants
        for (const v of (cat.variants || [])) {
            checkUnique('variants', v.vendorEntityId, `Variant in '${cat.name}'`);
            if (!v.prices || v.prices.length === 0) {
                errors.push(`Variant '${v.vendorEntityId}' in '${cat.name}': prices must not be empty`);
            }
            for (const p of (v.prices || [])) {
                if (p.value > 4000) {
                    errors.push(`Variant '${v.vendorEntityId}' in '${cat.name}': price ${p.value} exceeds ₹4000 limit`);
                }
            }
        }

        // Check for blocked keywords in name
        const blockedPhrases = [
            'subscription', 'charge for delivery', 'charge for packaging',
            'packaging charges', 'packing charges', 'delivery charges', 'extra charges'
        ];
        const lowerName = (cat.name || '').toLowerCase();
        const lowerDesc = (cat.description || '').toLowerCase();
        for (const phrase of blockedPhrases) {
            if (lowerName.includes(phrase) || lowerDesc.includes(phrase)) {
                errors.push(`Catalogue '${cat.name}': contains blocked keyword '${phrase}'`);
            }
        }
    }

    // Validate modifier groups
    for (const mg of (payload.modifierGroups || [])) {
        checkUnique('modifierGroups', mg.vendorEntityId, `ModifierGroup '${mg.name}'`);
        if (mg.min > mg.max) {
            errors.push(`ModifierGroup '${mg.name}': min (${mg.min}) cannot be greater than max (${mg.max})`);
        }
        if (mg.max < 1) {
            errors.push(`ModifierGroup '${mg.name}': max must be >= 1`);
        }
        if (mg.max > (mg.variants || []).length) {
            errors.push(`ModifierGroup '${mg.name}': max (${mg.max}) exceeds variant count (${(mg.variants || []).length})`);
        }
    }

    // Check for dangling catalogues (not in any subCategory entities and not in any modifier group)
    for (const cat of (payload.catalogues || [])) {
        const inSubCat = (payload.categories || []).some(c =>
            (c.subCategories || []).some(s =>
                (s.entities || []).some(e => e.vendorEntityId === cat.vendorEntityId)
            )
        );
        const inModGroup = (payload.modifierGroups || []).some(mg =>
            (mg.variants || []).some(v => v.catalogueVendorEntityId === cat.vendorEntityId)
        );
        if (!inSubCat && !inModGroup) {
            errors.push(`Catalogue '${cat.name}' (${cat.vendorEntityId}): dangling — not in any subCategory or modifierGroup`);
        }
    }

    return errors;
}

/**
 * Full menu sync: build from DB, validate, and push to Zomato.
 * Returns the API response from Zomato.
 */
async function syncMenuToZomato() {
    const menuPayload = await buildMenuPayload();

    // Validate before sending
    const validationErrors = validateMenuPayload(menuPayload);
    if (validationErrors.length > 0) {
        logger.warn('[ZOMATO MENU] Menu validation failed', { errors: validationErrors });
        throw new Error(`Menu validation failed:\n${validationErrors.join('\n')}`);
    }

    const catCount = menuPayload.categories?.length || 0;
    const itemCount = (menuPayload.catalogues || []).length;
    const mgCount = (menuPayload.modifierGroups || []).length;

    logger.info('[ZOMATO MENU] Syncing menu to Zomato', {
        categories: catCount,
        totalCatalogues: itemCount,
        modifierGroups: mgCount
    });

    const result = await addMenu(menuPayload);

    // Update lastMenuSync timestamp
    await prisma.platformConfig.update({
        where: { platform: 'ZOMATO' },
        data: { lastMenuSync: new Date() }
    });

    // Update lastSyncedAt on all ZOMATO mappings
    await prisma.menuItemMapping.updateMany({
        where: { platform: 'ZOMATO', isActive: true },
        data: { lastSyncedAt: new Date() }
    });

    return result;
}

/**
 * Sync stock status for all items to Zomato
 * Reads inventory and pushes in_stock/out_of_stock for every mapped item
 */
async function syncStockToZomato() {
    const mappings = await prisma.menuItemMapping.findMany({
        where: { platform: 'ZOMATO', isActive: true },
        include: {
            menuItem: {
                include: { inventory: true }
            }
        }
    });

    const items = mappings.map(m => ({
        item_id: m.platformItemId,
        in_stock: m.menuItem.inventory
            ? m.menuItem.inventory.quantity > 0 && !m.menuItem.inventory.lowStock
            : true
    }));

    if (items.length === 0) {
        return { skipped: true, message: 'No mapped items to sync' };
    }

    return updateStockStatus(items);
}

/**
 * Toggle stock for a single item on Zomato
 */
async function toggleItemStock(menuItemId, inStock) {
    const mapping = await prisma.menuItemMapping.findFirst({
        where: { menuItemId, platform: 'ZOMATO', isActive: true }
    });

    if (!mapping) {
        throw new Error(`No Zomato mapping found for menu item ${menuItemId}`);
    }

    return updateStockStatus([{
        item_id: mapping.platformItemId,
        in_stock: inStock
    }]);
}

// ─── Outlet Management: Delivery Charge ─────────────────────────────

/**
 * Update delivery charge for the outlet
 * POST /online-ordering/v3/restaurant/delivery-charge/update
 * 
 * @param {Object} chargeConfig - Delivery charge conditions
 *   e.g. { charges: [{ min_order_value, max_order_value, delivery_charge }] }
 */
async function updateDeliveryCharge(chargeConfig) {
    const config = await getZomatoConfig();
    return zomatoApiCall('/online-ordering/v3/restaurant/delivery-charge/update', 'POST', {
        restaurant_id: config.restaurantId,
        ...chargeConfig
    });
}

// ─── Outlet Management: Delivery Status ─────────────────────────────

/**
 * Get outlet delivery status
 * GET /online-ordering/v1/restaurant_delivery_status/get
 */
async function getDeliveryStatus() {
    const config = await getZomatoConfig();
    return zomatoApiCall(
        `/online-ordering/v1/restaurant_delivery_status/get?restaurant_id=${encodeURIComponent(config.restaurantId)}`,
        'GET'
    );
}

/**
 * Update outlet delivery status (toggle delivery on/off)
 * POST /online-ordering/v1/restaurant_delivery_status/update
 * 
 * @param {boolean} enabled - Whether delivery is enabled
 * @param {string} [reason] - Reason for status change
 */
async function updateDeliveryStatus(enabled, reason) {
    const config = await getZomatoConfig();
    return zomatoApiCall('/online-ordering/v1/restaurant_delivery_status/update', 'POST', {
        restaurant_id: config.restaurantId,
        delivery_enabled: enabled,
        reason: reason || undefined
    });
}

// ─── Outlet Management: Delivery Timings ────────────────────────────

/**
 * Get outlet delivery time (includes surge timings)
 * GET /online-ordering/v1/restaurant/delivery-time/get
 */
async function getDeliveryTime() {
    const config = await getZomatoConfig();
    return zomatoApiCall(
        `/online-ordering/v1/restaurant/delivery-time/get?restaurant_id=${encodeURIComponent(config.restaurantId)}`,
        'GET'
    );
}

/**
 * Add or remove surge delivery time
 * POST /online-ordering/v1/restaurant/delivery-time/add_surge
 * 
 * @param {number} surgeTime - Additional minutes on top of standard delivery time
 * @param {boolean} [remove=false] - If true, removes the surge
 */
async function addOrRemoveSurgeTime(surgeTime, remove = false) {
    const config = await getZomatoConfig();
    return zomatoApiCall('/online-ordering/v1/restaurant/delivery-time/add_surge', 'POST', {
        restaurant_id: config.restaurantId,
        surge_time: surgeTime,
        remove: remove
    });
}

/**
 * Get Zomato delivery timings for the outlet
 * GET /online-ordering/v1/restaurant/zomato-delivery-timings/get
 */
async function getZomatoDeliveryTimings() {
    const config = await getZomatoConfig();
    return zomatoApiCall(
        `/online-ordering/v1/restaurant/zomato-delivery-timings/get?restaurant_id=${encodeURIComponent(config.restaurantId)}`,
        'GET'
    );
}

/**
 * Update Zomato delivery timings for the outlet
 * POST /online-ordering/v1/restaurant/zomato-delivery-timings/update
 * 
 * @param {Object} timings - Delivery timing configuration
 */
async function updateZomatoDeliveryTimings(timings) {
    const config = await getZomatoConfig();
    return zomatoApiCall('/online-ordering/v1/restaurant/zomato-delivery-timings/update', 'POST', {
        restaurant_id: config.restaurantId,
        ...timings
    });
}

/**
 * Get self-delivery timings for the outlet
 * GET /online-ordering/v1/restaurant/self-delivery-timings/get
 */
async function getSelfDeliveryTimings() {
    const config = await getZomatoConfig();
    return zomatoApiCall(
        `/online-ordering/v1/restaurant/self-delivery-timings/get?restaurant_id=${encodeURIComponent(config.restaurantId)}`,
        'GET'
    );
}

/**
 * Update self-delivery timings for the outlet
 * POST /online-ordering/v1/restaurant/self-delivery-timings/update
 * 
 * @param {Object} timings - Self-delivery timing configuration
 */
async function updateSelfDeliveryTimings(timings) {
    const config = await getZomatoConfig();
    return zomatoApiCall('/online-ordering/v1/restaurant/self-delivery-timings/update', 'POST', {
        restaurant_id: config.restaurantId,
        ...timings
    });
}

// ─── Outlet Management: Logistics Status ────────────────────────────

/**
 * Get outlet logistics status (Zomato logistics + self-delivery availability)
 * GET /online-ordering/v1/restaurant/logistics-status/get
 */
async function getLogisticsStatus() {
    const config = await getZomatoConfig();
    return zomatoApiCall(
        `/online-ordering/v1/restaurant/logistics-status/get?restaurant_id=${encodeURIComponent(config.restaurantId)}`,
        'GET'
    );
}

/**
 * Update self-delivery serviceability status
 * POST /online-ordering/v1/restaurant/logistics-status/update_self_delivery_serviceability
 * 
 * @param {boolean} enabled - Whether self-delivery is serviceable
 * @param {string} [reason] - Reason for change
 */
async function updateSelfDeliveryServiceability(enabled, reason) {
    const config = await getZomatoConfig();
    return zomatoApiCall('/online-ordering/v1/restaurant/logistics-status/update_self_delivery_serviceability', 'POST', {
        restaurant_id: config.restaurantId,
        self_delivery_enabled: enabled,
        reason: reason || undefined
    });
}

module.exports = {
    getZomatoConfig,
    confirmOrder,
    rejectOrder,
    markOrderReady,
    markOrderPickedUp,
    assignDeliveryPartner,
    markOrderDelivered,
    updateComplaint,
    updateMerchantAgreedCancellation,
    getContactDetails,
    getOrderRating,
    notifyZomatoStatusChange,
    // Menu Management
    addMenu,
    getMenu,
    updateStockStatus,
    buildMenuPayload,
    validateMenuPayload,
    detectDietaryTag,
    syncMenuToZomato,
    syncStockToZomato,
    toggleItemStock,
    // Outlet Management: Delivery Charge
    updateDeliveryCharge,
    // Outlet Management: Delivery Status
    getDeliveryStatus,
    updateDeliveryStatus,
    // Outlet Management: Delivery Timings
    getDeliveryTime,
    addOrRemoveSurgeTime,
    getZomatoDeliveryTimings,
    updateZomatoDeliveryTimings,
    getSelfDeliveryTimings,
    updateSelfDeliveryTimings,
    // Outlet Management: Logistics Status
    getLogisticsStatus,
    updateSelfDeliveryServiceability
};
