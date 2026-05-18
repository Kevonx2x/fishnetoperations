import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, "../components/marketplace/fishnet-home-marketplace.tsx");
let s = readFileSync(path, "utf8");

const sheetEnd = "                }}\r\n              />\r\n\r\n";
let sheetIdx = s.indexOf(sheetEnd);
if (sheetIdx < 0) {
  const alt = "                }}\n              />\n\n";
  sheetIdx = s.indexOf(alt);
  if (sheetIdx < 0) {
    console.error("sheetEnd not found");
    process.exit(1);
  }
}
const start = sheetIdx + (s.indexOf(sheetEnd) >= 0 ? sheetEnd.length : "                }}\n              />\n\n".length);

const endMarker = "              {!isResultsMode && neighborhoodFilter";
const end = s.indexOf(endMarker, start);
if (end < 0) {
  console.error("endMarker not found at", start);
  process.exit(1);
}

const animateBlock = `              <AnimatePresence mode="wait" initial={false}>
                {isResultsMode ? (
                  <motion.div
                    key="listing-results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                  >
                    <HomepageResultsSurface
                      heading={resultsHeading}
                      chips={
                        <>
                          {activeFilterChips(filters, sortMode, filterChipActions, {
                            search: neighborhoodLabelForChips ? undefined : search,
                            neighborhoodLabel: neighborhoodLabelForChips,
                          }).map((chip) => (
                            <button
                              key={chip.key}
                              type="button"
                              onClick={chip.onRemove}
                              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-neutral-50"
                            >
                              {chip.label}
                              <span className="text-[#2C2C2C]/35" aria-hidden>
                                ×
                              </span>
                            </button>
                          ))}
                        </>
                      }
                      activeFilterCount={countActiveFilters(filters, sortMode)}
                      sortMode={sortMode}
                      onSortChange={setSortMode}
                      onFiltersClick={() => setFiltersOpen(true)}
                      onClearAllChips={clearFiltersAndBrowse}
                      isEmpty={sortedAllRows.length === 0}
                      emptyCta={
                        <HomepageExpandSearchCta
                          message="No matches found. Try removing a filter or expanding your search area."
                          onExpand={handleExpandSearch}
                        />
                      }
                      expandSearchCta={
                        sortedAllRows.length > 0 && sortedAllRows.length <= 4 ? (
                          <HomepageExpandSearchCta
                            message={\`Looking for more? Expand your search by removing one filter, or browse all \${mode === "rent" ? "rentals" : "listings"} in Metro Manila.\`}
                            onExpand={handleExpandSearch}
                          />
                        ) : undefined
                      }
                    >
                      {sortedAllRows.map((p, i) => (
                        <NewlyListedCard
                          key={\`result-\${p.id}\`}
                          property={p}
                          roomUrls={roomUrlsFor(p)}
                          roomIdx={cardRoomIdx[p.id] ?? 0}
                          onRoomPrev={() =>
                            setCardRoomIdx((s) => ({
                              ...s,
                              [p.id]:
                                (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) %
                                Math.max(1, roomUrlsFor(p).length),
                            }))
                          }
                          onRoomNext={() =>
                            setCardRoomIdx((s) => ({
                              ...s,
                              [p.id]: ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                            }))
                          }
                          engagement={engagement}
                          connectedAgents={allConnectedAgentsByPropertyId.get(p.id) ?? []}
                          onOpenPropertyZoom={() => setZoomProperty(p)}
                          grid
                          viewerUserId={user?.id ?? null}
                          verifiedListingAgent={viewerVerifiedListingAgent}
                          listingImageLoadEager={i < 3}
                          listingImagePriority={i < 2}
                        />
                      ))}
                    </HomepageResultsSurface>
                  </motion.div>
                ) : (
                  <motion.div
                    key={\`browse-\${mode}\`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="mt-8"
                  >
                    <PropertyRows
                      rows={defaultHomepageRows}
                      showMore={showMoreCategories}
                      onToggleShowMore={() => setShowMoreCategories((v) => !v)}
                      rowRefs={rowRefs}
                      cardRoomIdx={cardRoomIdx}
                      setCardRoomIdx={setCardRoomIdx}
                      engagement={engagement}
                      connectedAgentsByPropertyId={allConnectedAgentsByPropertyId}
                      viewerUserId={user?.id ?? null}
                      onOpenPropertyZoom={setZoomProperty}
                      viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                      listingsOnboardingHref={user ? "/register/agent" : "/auth/signup"}
                      rowTitleSuffix={browseRowTitleSuffix}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

`;

// Find AnimatePresence start after sheet (skip legacy comments)
const animateStart = s.indexOf("<AnimatePresence mode=\"wait\" initial={false}>", start);
if (animateStart < 0) {
  console.error("AnimatePresence not found");
  process.exit(1);
}

s = s.slice(0, animateStart) + animateBlock.trimStart() + "\n\n" + s.slice(end);
writeFileSync(path, s);
console.log("OK: replaced", end - animateStart, "chars");
