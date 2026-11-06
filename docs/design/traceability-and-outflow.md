# Traceability and product outflow: design proposal

Status: proposal, not implemented. Owners: backoffice (this repo) and backend (`armachecafe`).

This document defines the domain model for locations, lots and stock movements, the farm-to-plant
chain, and product outflow from distribution locations with lot-level traceability. Outflow
(phases O1-O3) is built first. The farm-to-plant chain (F1-F6) follows. B2B sales (B1-B3) are paused.

## Glossary

The backoffice UI uses the Spanish terms; code and the API contract use the English ones.

| UI (ES) | Code (EN) | Meaning |
|---|---|---|
| Finca | Farm | A company-owned coffee farm |
| Parcela | Plot | A field inside a farm with one variety; the unit of origin |
| Acopio | Storage (bulk or packed) | A location that holds stock without transforming it |
| Planta | Plant | A location that transforms coffee (hulling, roasting, packaging) |
| Centro de distribución (CD) | Distribution location | A location with the `DISTRIBUTION` role; it fulfills orders |
| Tienda / cafetería | Store | A location that sells to customers; cafés are stores |
| Lote | Lot | A physical quantity of coffee with its own identity |
| Microlote | Microlot | A lot whose history meets single-origin rules (computed, never entered) |
| Cereza / pergamino / verde / tostado | Cherry / parchment / green / roasted | Material states |
| Merma | Loss | Mass lost in a transformation or in transit |
| Traslado | Transfer | Moving stock between two locations |
| Preparación | Picking | Choosing the physical units, and their lots, for an order |

## Current state (contract `admin@1.2.0`)

Verified in `src/types/api.ts`:

- A farm exists only as the free-text `farmId` of `HarvestRecord`. `RegisterHarvestResult`
  returns no `lotCode`, so no lot can point back to a harvest.
- `MesProcess` is `ROASTING | GRINDING | PACKAGING`. MES quantities are decimal kg; harvest,
  split and merge use integer grams.
- `Transfer.fromLocation` and `Transfer.toLocation` are free text, and transfer items carry
  `sku` and `quantity` without a lot.
- `BackofficeOrderItem` has no lot, so forward traceability stops at the order.
- `StockAlert` and `StockReportRow` count stock per SKU, without a location.

Already in place and reused by this design: courier and tracking number captured on
`PREPARING → DISPATCHED` (`src/components/orders/state-transition-button.tsx`), the order
statuses, returns, split and merge with mass balance, `referenceId` idempotency, and the
`PICKUP` (`pickupLocationId`) and `DELIVERY` (`zoneId`) shipping methods of the B2B order input
in `src/lib/api.ts`.

Front/contract mismatches found while reviewing (not confirmed on screen):

- `StockAlert` and `StockReportRow` in `src/lib/api.ts` expect `locationId`, `locationName` and
  `quantity`; the contract sends `currentStock` and no location. The stock alerts and stock
  report screens likely show empty fields.
- The contract's `LotSearchResult` has no `lotId`, but `/trazabilidad` selects a search result by
  `lot.lotId`. The page likely requests `/backoffice/traceability/lots/undefined` and shows no
  detail. In the detail, the front expects `ancestorLotCode`, `ancestorSku` and `relationship`
  backward, and `orderCode`, `customerName` and `linkedAt` forward; the contract sends
  `lotCode`, `relation` and `sku` in both lists.
- `src/components/orders/state-transition-button.tsx` swallows errors ("Error handling silenced
  for MVP"). A transition the server rejects fails without any message.

## Principles

1. **Places, lots and events are different things.** Farms, plots and stores are master data,
   registered once. Lots are material that is created, transformed and consumed. Events
   (harvest, roast, transfer, sale) are what happens to lots.
2. **Stock is never edited.** Stock is the sum of movements. Corrections are adjustment
   movements with a reason.
3. **Events are immutable.** A mistake is fixed with a new compensating event, which keeps a
   full audit trail.
4. **Every event carries a client-generated `referenceId`**, so retries are idempotent, as
   harvest, split and merge already do.
5. **Mass balance.** For every transformation, inputs equal outputs plus loss. Typical yields
   only raise warnings; they never reject a record.
6. **Integer units.** Bulk in grams, packaged stock in units, money in cents.
7. **Stock leaves inventory when the product leaves company custody**: when it is handed to the
   courier, or when the customer picks it up.

## Locations and roles

There is one `Location` entity. Each location has one or more roles:

| Role | Allows | Inventory |
|---|---|---|
| `FARM` | harvest, wet processing, drying | bulk |
| `BULK_STORAGE` | receiving, consolidation, dispatch to plant | bulk |
| `PLANT` | hulling, grading, cupping, roasting, grinding, packaging | bulk and packaged |
| `PACKED_STORAGE` | receiving and holding packaged product | packaged |
| `DISTRIBUTION` | fulfilling orders, replenishing stores | packaged |
| `STORE` | counter sales, pickup, bar consumption, online orders | packaged |

Rules:

- A location accepts only the inventory classes its roles allow. A transfer of parchment to a
  café is rejected.
- A café is a `STORE`, and may also be `PACKED_STORAGE` and `DISTRIBUTION`.
- Every `STORE` has `suppliedBy`: the location that replenishes it.
- Order fulfillment candidates are the locations with the `DISTRIBUTION` role.
- Two virtual locations exist: `IN_TRANSIT` for transfers on the way, and `CUSTOMER` for sold
  product.
- Bulk storage is company-owned for now. Purchases from external producers are out of scope; the
  model can add them later as an origin event.

## Inventory classes and lots

- **Bulk**: counted per lot, in grams (cherry, parchment, green, unpacked roasted).
- **Packaged**: counted per SKU and lot, in units. Each SKU has a net weight.
- **One packaged lot belongs to exactly one SKU.** The GS1-128 code carries the GTIN and the lot,
  so scanning resolves both.
- A packaged lot has `lotCode`, `sku`, `roastedAt`, `bestBefore`, `status`, and the roasted lot
  it came from once packaging records it (phase F5).
- Until F5, a packaged lot enters the registry when a count finds a lot code the system does not
  know: the counter registers it on the spot with its SKU, roast date and best-before date.
- Lot status: `AVAILABLE`, `QUARANTINE`, `BLOCKED`, `DEPLETED`. A lot in quarantine cannot be
  picked in any location, and neither can the lots derived from it.
- Stock key: (location, lot, SKU). `available = onHand - reserved - allocated`.

## Movements

| Type | When |
|---|---|
| `IN` | harvest, output of a process, return |
| `TRANSFER_OUT` / `TRANSFER_IN` | a transfer leaves A (stock moves to `IN_TRANSIT`) and enters B when B confirms receipt |
| `ADJUSTMENT` | physical count, with a mandatory reason; also any server-side correction the backend posts |

Dispatches and receive shortfalls are posted by the O2 and receive endpoints on the server; the
front never posts a movement type directly except through counts. How a dispatch and a transit
shortfall appear in the ledger (which `type` and `reason`) is an open question for backend.

Every movement records the location, lot, SKU (packaged only), quantity, `referenceId`, actor,
timestamp, reason, and the document that caused it (order, transfer, count, process order).

### Counts

Counts are partial: only the lots in the count are adjusted. A lot is set to zero only when the
count includes it with quantity 0. Lots not in the count keep their stock.

### Transfers

| Status | Meaning | Stock effect |
|---|---|---|
| `REQUESTED` | Created with SKU and quantity, without lots (for example by the assigner, for a shortfall) | reserved at the source |
| `IN_TRANSIT` | The source scanned the bags and shipped them | `TRANSFER_OUT` per lot; stock in `IN_TRANSIT` |
| `RECEIVED` | The destination scanned what arrived | `TRANSFER_IN` per lot; a shortfall posts `TRANSIT_LOSS` |
| `CANCELLED` | Cancelled before shipping | reservation released |

A transfer created at the source by scanning lots skips `REQUESTED`. A `REQUESTED` transfer ships
only when every line is fully scanned. At receipt, a lot that was not shipped in the transfer, or
a quantity above the shipped one, is rejected.

## Product outflow from a distribution location

This part is built first. It gives lot → order → customer traceability without waiting for the
farm-to-plant chain.

### Order lifecycle

| Status | What the operator does | Stock effect |
|---|---|---|
| `CONFIRMED`, unassigned | The order waits in the central "Por asignar" queue | none |
| `CONFIRMED`, assigned | The assigner chooses the distribution location | stock reserved at that location |
| `PREPARING` | Staff at the location scan the bags | the reservation becomes an allocation to specific lots |
| `DISPATCHED` (shipping) | Courier and tracking number entered, as today | `OUT` from the location, per lot |
| `DISPATCHED` (pickup) | The order is ready at the pickup store | none; units stay allocated |
| `DELIVERED` (shipping) | Delivery confirmed | none |
| `DELIVERED` (pickup) | The customer takes the order | `OUT` from the store, per lot |
| `CANCELLED` | Before custody leaves: release. After: process as a return | release, or return `IN` |

No new `OrderStatus` value is added. The front's `OrderStatus` type in `src/lib/api.ts` is
hand-written and the storefront consumes the same enum, so a new value could break both. Pickup
readiness is a field, `readyForPickupAt`, set when a pickup order moves to `DISPATCHED`. For
pickup orders the front shows "Listo para retiro" instead of the courier inputs.

### Assignment

- One person assigns every order (permission `order:assign`).
- The "Por asignar" queue lists `CONFIRMED` unassigned orders. For each order it shows every
  distribution location and, per line, the available quantity: covers all, covers part, or none.
- For a pickup order, the pickup store is pre-selected when it has the `DISTRIBUTION` role. The
  assigner confirms or changes it.
- The assignment can change until the order is `PREPARING`. Changing it releases the old
  reservation and reserves at the new location.
- Each assignment records who, when, and the reason when it changes.

### Missing stock

One location per order. When the chosen location lacks part or all of the order, the assigner
creates a `REQUESTED` transfer of the shortfall (SKU and quantity) from another location, linked
to the order (`forOrderId`). The source ships it by scanning. The order shows "Esperando
traslado" and becomes pickable when the transfer is received. Orders are never split across
locations, so each order has a single shipment and a single tracking number.

### Picking by scan

Bags carry a GS1-128 barcode with lot, dates and quantity.

- The picking screen keeps a focused input. USB and Bluetooth scanners type the code followed by
  Enter, so this works in the browser without camera access.
- Each scan counts one unit. The system resolves the lot, then checks that its SKU has pending
  quantity in the order, that the lot is at this location, and that its status is `AVAILABLE`.
- If the scanned lot is not the one that expires first (FEFO), the screen warns and requires a reason, which travels with the pick.
- A line can be filled from several lots.
- A wrong scan is undone by removing one unit of that lot from the line (unpick).
- An order waiting for a transfer cannot be picked.
- The order cannot move to `DISPATCHED` until every line is fully picked.

### Pickup at the store the customer chose

- The customer chooses the pickup store at checkout. Pickup stores are the locations with the
  `STORE` role.
- If the fulfillment location is the pickup store, the order moves to `DISPATCHED`, ready for
  pickup, after picking.
- Otherwise, after picking, the location sends the order to the pickup store. This creates an
  `IN_TRANSIT` transfer of the allocated lots, linked to the order, and the order stays
  `PREPARING`. When the store receives the transfer by scanning, the order moves to `DISPATCHED`
  with `readyForPickupAt`.
- Each store has a "Listos para retiro" queue and marks the order `DELIVERED` when the customer
  takes it.

### Getting packaged stock into the distribution locations

1. Until phase F5, packaged lots enter the system through an initial count per location, done by
   scanning. Run it at O2 go-live: between O1 and O2, dispatches post no movements and the stock
   would drift.
2. Plant → distribution location moves are transfers with lots, received by scanning.
3. Once phase F5 lands, packaging creates the packaged lot with its link to the roasted lot, and
   the trace extends backward with no extra work.

## Farm-to-plant chain (phases F1-F6)

```
CHERRY --wet processing--> WET PARCHMENT --drying--> DRY PARCHMENT --hulling--> GREEN
GREEN --grading--> GREEN per grade (+ rejects)
GREEN --roasting--> ROASTED --grinding--> GROUND --packaging--> PACKAGED (SKU + lot)
```

- The processing method (washed, natural, honey, anaerobic) is a field of the wet-processing
  event. Natural coffee dries as whole cherry and goes straight to hulling.
- The harvest `quality` (`MADURO | MIXTO | VERDE`) is cherry ripeness, not cup quality. The SCA
  score is a later cupping measurement on green or roasted lots.
- A lot has an opaque internal `lotId` and a readable `lotCode` (for example
  `CE-MIR-261105-01`). The code carries no data that can change, such as location or grade.
- Harvest creates a cherry lot from a plot. This closes the first link of the chain.
- Bulk storage receives lots from farms by transfer; the lot keeps its code and history. It may
  consolidate small lots into one (the existing merge). Lots meant to sell as microlots are not
  consolidated.
- Each lot has a computed origin composition, for example "70% Plot 3, 30% Plot 5". A lot is a
  microlot when 100% of its mass comes from one farm (optionally one plot or variety), with one
  processing method and a short harvest window. Mixing in another farm's lot removes the
  microlot label automatically.

## Traceability and recall

Lots and events form a graph. Backward: from a packaged unit to its plots. Forward: from a plot or
lot to orders and customers.

To recall a lot (phase O3), put it in quarantine. The system stops offering it at picking, lists
the remaining units per location so they can be pulled, and lists the orders and customers that
already received it, with dispatch date, location, courier and tracking number.

## Backoffice screens

| Screen | Route | Sidebar group | Phase |
|---|---|---|---|
| Ubicaciones | `/inventario/ubicaciones` | Inventario | O1 |
| Stock, with movements | `/inventario/stock` | Inventario | O1 |
| Conteos | `/inventario/conteos` | Inventario | O1 |
| Traslados: new, ship, receive | `/inventario/traslados` | Inventario | O1 |
| Asignación de pedidos | `/despacho/asignacion` | Despacho | O2 |
| Preparación | `/despacho/preparacion` | Despacho | O2 |
| Retiro en tienda | `/despacho/retiro` | Despacho | O2 |
| Order detail: Despacho section | `/pedidos/detalle?id=` | - | O2 |
| Trazabilidad: forward, lot status, recall | `/trazabilidad` | - | O3 |

The current `/almacen/transferencias` stays until the backend retires `/backoffice/wms/transfers`.
Later phases add the Finca, Acopio and Planta sections, and store screens for counter sales and
bar consumption.

## Phases

| Phase | Scope | Depends on |
|---|---|---|
| O1 | Locations with roles, packaged lots, stock per location and lot, movement ledger, partial counts by scan, transfers with lots | - |
| O2 | Central assignment, reservation, picking by scan, dispatch and pickup posting `OUT`, transfers linked to orders | O1 |
| O3 | Forward traceability (lot → orders → customers), lot status, recall | O2 |
| F1 | Farms and plots as master data; harvest takes `plotId` and creates a cherry lot | O1 |
| F2 | Bulk storage: transfers of bulk lots, consolidation | F1 |
| F3 | Wet processing and drying with mass balance | F2 |
| F4 | Plant receiving, hulling, grading, cupping | F3 |
| F5 | Packaging creates packaged lots linked to the roasted lot | F4, O1 |
| F6 | Origin composition, computed microlot | F5 |
| B1-B3 | B2B clients, contract pricing, invoicing | paused |

The new stock and forward-traceability endpoints of O1-O3 replace the shapes behind the
front/contract mismatches listed in Current state.

## Contract proposal for O1-O2

Everything is additive, under new paths. Shapes are shorthand; the contract defines the exact
schemas.

```
LocationRole      = FARM | BULK_STORAGE | PLANT | PACKED_STORAGE | DISTRIBUTION | STORE
Location          { locationId, code, name, roles: LocationRole[], suppliedBy?, active }
LotStatus         = AVAILABLE | QUARANTINE | BLOCKED | DEPLETED
PackagedLot       { lotCode, sku, roastedAt, bestBefore, status: LotStatus, sourceLotCode? }
CreateLotRequest  { lotReferenceId, lotCode, sku, roastedAt, bestBefore, actorId, at }
StockRow          { locationId, sku, lotCode, lotStatus, onHand, reserved, allocated, available,
                    bestBefore }
Movement          { movementId, type, locationId, lotCode, sku?, quantity, referenceId,
                    reason?, actorId, at, source: { kind, id } }
CountRequest      { countReferenceId, locationId, reason, lines: [{ lotCode, countedQuantity }],
                    actorId, at }
InventoryTransferStatus = REQUESTED | IN_TRANSIT | RECEIVED | CANCELLED
Transfer          { transferId, status, fromLocationId, toLocationId, forOrderId?,
                    lines: [{ sku, quantity, lots: [{ lotCode, shipped, received? }] }],
                    createdAt }
CreateTransferRequest { transferReferenceId, fromLocationId, toLocationId, forOrderId?,
                    lines: [{ sku, quantity, lots: [{ lotCode, shipped }] }], actorId, at }
ShipRequest       { shipReferenceId, scans: string[], actorId, at }
ReceiveRequest    { receiveReferenceId, lines: [{ lotCode, receivedQuantity }], actorId, at }
FulfillmentOption { locationId, name, fullyAvailable, lines: [{ sku, requested, available }] }
AssignRequest     { fulfillmentLocationId, reason?, actorId, at }
PickRequest       { pickReferenceId, scans: [{ lotCode, quantity }], actorId, at }
UnpickRequest     { unpickReferenceId, lotCode, quantity, actorId, at }
SendToPickupRequest { sendReferenceId, actorId, at }
OrderFulfillment  { fulfillmentLocationId?, assignedBy?, assignedAt?, pickupLocationId?,
                    waitingForTransferId?, pickupTransferId?, readyForPickupAt?,
                    lines: [{ sku, quantity, lots: [{ lotCode, quantity }] }] }
```

| Phase | Method | Path | Purpose |
|---|---|---|---|
| O1 | GET | `/backoffice/locations?role=` | list locations |
| O1 | POST | `/backoffice/locations` | create a location |
| O1 | PATCH | `/backoffice/locations/{locationId}` | change roles, `suppliedBy`, `active` |
| O1 | GET | `/backoffice/inventory/stock` | stock rows (no filters; the front filters locally) |
| O1 | GET | `/backoffice/inventory/movements` | movement ledger (no filters; the front filters locally) |
| O1 | GET | `/backoffice/inventory/lots/{lotCode}` | resolve a scanned lot |
| O1 | POST | `/backoffice/inventory/lots` | register a packaged lot found during a count |
| O1 | POST | `/backoffice/inventory/counts` | partial count; posts `ADJUSTMENT` movements |
| O1 | GET | `/backoffice/inventory/transfers?fromLocationId=&toLocationId=&status=&forOrderId=` | list transfers |
| O1 | POST | `/backoffice/inventory/transfers` | create; lot lines ship at once, SKU lines stay `REQUESTED` |
| O1 | POST | `/backoffice/inventory/transfers/{transferId}/ship` | scan at the source; `REQUESTED → IN_TRANSIT` |
| O1 | POST | `/backoffice/inventory/transfers/{transferId}/receive` | receive; a shortfall posts `TRANSIT_LOSS` |
| O2 | GET | `/backoffice/orders/{orderId}/fulfillment-options` | availability per distribution location |
| O2 | POST | `/backoffice/orders/{orderId}/assign` | assign or reassign; reserves stock |
| O2 | POST | `/backoffice/orders/{orderId}/pick` | scanned lots; allocates them to lines |
| O2 | POST | `/backoffice/orders/{orderId}/unpick` | undo a wrong scan |
| O2 | POST | `/backoffice/orders/{orderId}/send-to-pickup-store` | create the `IN_TRANSIT` transfer to the pickup store |
| O2 | GET | `/backoffice/orders?assigned=&fulfillmentLocationId=&pickupLocationId=` | queue filters added to the existing list |

`BackofficeOrderDetail` gains an optional `fulfillment: OrderFulfillment`.

Errors reuse `VALIDATION_ERROR`, `NOT_FOUND` and `CONFLICT`. `CONFLICT` covers: assigning an order
that is already `PREPARING` or later; picking an order that waits for a transfer; a scanned lot
that is not at the location, not `AVAILABLE`, of an SKU not in the order, or beyond the line's
pending quantity; receiving a lot not shipped in the transfer, or above the shipped quantity;
registering a lot code that already exists; a transfer to a location whose roles do not accept the
inventory class.

Compatibility:

- `/backoffice/wms/transfers` and its screen keep working until the new transfers screen replaces
  them.
- `POST /backoffice/orders/{orderId}/transition` keeps its request shape. Three rules go behind a
  server-side switch, turned on when the assignment and picking screens ship: no `PREPARING`
  without an assignment, no `DISPATCHED` without full picking, and the `OUT` postings. Until then,
  transitions behave as today.
- Receiving an order's transfer at its pickup store moves the order to `DISPATCHED` and sets
  `readyForPickupAt`.
- No new `OrderStatus` values (see Order lifecycle).
- To confirm on the storefront side: the online order must carry the pickup store the customer
  chose. In this repo, `pickupLocationId` only appears in the B2B order input.
- Moving MES from kg to grams breaks `inputQtyKg` and `outputQtyKg` and needs its own plan; it
  is not part of O1-O2.

Permissions to define: `location:manage`, `inventory:view`, `inventory:count`,
`inventory:transfer`, `order:assign`, `order:pick`.

## Contract outline for O3

To propose after O2 ships. These change the admin contract only.

- `GET /backoffice/traceability/lots/{lotCode}`: `forward` returns orders: `orderId`,
  `orderCode`, `customerName`, `quantity`, `dispatchedAt`, `fulfillmentLocationId`,
  `courierName?`, `trackingNumber?`. The current path parameter is named `lotId`; confirm it
  takes a lot code.
- `POST /backoffice/inventory/lots/{lotCode}/status` `{ status, reason, actorId, at }`. The
  status also applies to derived lots.
- `GET /backoffice/inventory/lots/{lotCode}/recall`: remaining units per location and lot, and
  the orders and customers that received it.
- Permission: `inventory:lot:status`.

## Decisions

Recorded from the user, quoted verbatim where available.

1. Bulk storage is company-owned for now: "por ahora el acopio es propio".
2. A café is a store and can also be packed storage and a distribution location: "por ahora las
   cafeterias son las tiendas", "una cafeteria puede ser un punto de acopio solo de cafe empacado
   y tambien centro de distribucion".
3. Stores take online orders: "las tiendas atienden pedidos online".
4. B2B sales are out of scope for now; outflow and traceability are in scope: "el B2B por ahora
   queda fuera de la venta, pero si se nececita trabajar la salida de producto y trazabilidad".
   For when B2B resumes: "las ventas para empresa tienen un precio distinto y el precio se mnaneja
   por contrato con cliente B2B con facturacion".
5. Product ships from a distribution location, chosen manually: "sale de un CD el producto, la
   asignacion de envio se elige de forma manual".
6. Missing stock: one location per order; the shortfall is transferred first ("vamos con
   recomendacion").
7. Pickup: "el cliente elige la tienda".
8. Bags have the lot code printed, with a barcode ("si").
9. "una persona asigna los pedidos".
10. The bag barcode is GS1-128 with lot, dates and quantity (relayed by the backend session).
11. Skipping FEFO requires a mandatory reason (relayed by the backend session).
12. Picking happens on cellphone (relayed by the backend session).

## Open questions

1. Answered: GS1-128 with lot, dates and quantity. The scan resolves the SKU from the GTIN in the
   code. Exact AIs to confirm (expected: `01` GTIN, `10` lot, `15` best-before, `37` count). (O1)
2. Answered: skipping FEFO requires a mandatory reason, collected at picking and enforced by the
   contract on the pick call. (O2)
3. Backend: do packaged lots already exist in the traceability service? `LotSearchResult` already
   carries `sku`, `roastDate` and `status`. If so, `PackagedLot` should reuse that registry
   instead of creating a second one. (O1)
4. Answered: picking on cellphone. Operational screens must be usable below 768 px and reachable
   from the mobile nav (Conteos, Traslados, Preparación, Retiro). (O1-O2)
5. Backend: is there a non-production environment to test counts, transfers and picking? Writes
   must not be tested against production. (O1-O3)
6. Where are wet processing and drying done: on the farm or at the plant? (F3)
7. Do you export, or plan to export, to the EU? It decides whether plots need polygons (EUDR). (F1)
8. Which processing methods do you use: washed, natural, honey, anaerobic? (F3)
9. Café bar consumption: is recording each opened bag enough? (store phase)
10. B2B, when it resumes: which store serves each client, what happens with an SKU outside the
    contract, invoice grouping and credit terms, and whether an invoicing provider is already in use.
