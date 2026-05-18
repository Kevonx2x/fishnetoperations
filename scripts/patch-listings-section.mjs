import { readFileSync, writeFileSync } from "fs";

const p = "components/marketplace/fishnet-home-marketplace.tsx";
let text = readFileSync(p, "utf8");

const start = text.indexOf("            {/* PROPERTY LISTING SECTION (controlled by Buy/Rent toggle) */}");
const end = text.indexOf("            {/* 7. WHY FISHNET TRUST SECTION */}");
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const newBlock = `            {/* PROPERTY LISTING SECTION (controlled by Buy/Rent toggle) */}
            <section id="listings">
              <HomepageFiltersSheet
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                filters={filters}
                onFiltersChange={setFilters}
                locationOptions={FEATURED_LOCATIONS.map((loc) => ({ label: loc.label }))}
                matchCount={sortedAllRows.length}
                onClearAll={() => setSortMode("newest")}
                onApply={() => {
                  setFiltersOpen(false);
                  requestAnimationFrame(() => {
                    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              />

              <AnimatePresence mode="wait" initial={false}>
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

              {!isResultsMode && neighborhoodFilter && cityFilterMeta ? (
                <div className="mt-12 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                  <h2 className="font-serif text-xl font-semibold tracking-tight text-[#2C2C2C] sm:text-2xl">
                    Top Agents in {cityFilterMeta.label}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
                    Verified agents who serve this area
                  </p>
                  {agentsForCityFilter.length === 0 ? (
                    <p className="mt-6 text-center text-sm font-semibold text-[#2C2C2C]/45">
                      No agents list this city in their service areas yet.
                    </p>
                  ) : (
                    <div className="mt-6 flex flex-wrap justify-center gap-4 md:justify-start">
                      {agentsForCityFilter.map((a) => (
                        <AgentDirectoryCard
                          key={\`city-agent-\${a.id}\`}
                          agent={a}
                          className="w-full sm:w-[300px]"
                          scoreBesideName
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </section>

`;

text = text.slice(0, start) + newBlock + text.slice(end);
writeFileSync(p, text, "utf8");
console.log("patched", end - start, "->", newBlock.length);
