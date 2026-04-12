import fs from "fs";

const path = "components/client/mobile-client-dashboard.tsx";
let s = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const openDoc = "  const openOwnDocument = async (file_url: string) => {";
const i1 = s.indexOf(openDoc);
const fnStart = s.indexOf("export function MobileClientDashboard()");
if (i1 === -1 || fnStart === -1) {
  console.error("markers not found", { i1, fnStart });
  process.exit(1);
}
const braceAfter = s.indexOf("{", fnStart) + 1;

const inner = `
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();

  const [mainTab, setMainTab] = useState<MainTab>("my_profile");
  const [listingMode, setListingMode] = useState<ListingMode>("rent");
  const [viewBusyUrl, setViewBusyUrl] = useState<string | null>(null);

  const feed = useClientActivityFeed(user?.id);
  const {
    loading,
    fullName,
    avatarUrl,
    createdAt,
    clientPrefs,
    badges,
    savedRows,
    likeRows,
    ownDocs,
    sharedDocs,
    unreadCount,
    feedGrouped,
    feedAgentMeta,
    propertyStatusById,
  } = feed;

  const likes = usePropertyLikes();
  const pins = usePinnedPropertyIds();

  const prefsComplete = useMemo(
    () => (clientPrefs ? isClientProfilePrefsComplete(clientPrefs) : false),
    [clientPrefs],
  );

  const feedGroupedFiltered = useMemo(() => {
    return feedGrouped
      .map((g) => ({
        ...g,
        items: filterFeedItemsByListingMode(g.items, listingMode, propertyStatusById),
      }))
      .filter((g) => g.items.length > 0);
  }, [feedGrouped, listingMode, propertyStatusById]);

  const savedRowsFiltered = useMemo(
    () => filterSavedRowsByMode(savedRows, listingMode),
    [savedRows, listingMode],
  );
  const likeRowsFiltered = useMemo(() => filterLikeRowsByMode(likeRows, listingMode), [likeRows, listingMode]);

`;

const out = s.slice(0, braceAfter) + inner + s.slice(i1);
fs.writeFileSync(path, out);
console.log("patched ok", { removedChars: i1 - braceAfter, addedChars: inner.length });
