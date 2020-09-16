/**
 * Create breadCrumb list from path.
 */
export default function makeBreadCrumbs(pageId) {
  if (pageId === "Home") {
    return [{ name: "Home" }];
  }

  const ret = [{ name: "wiki", link: "/wiki/" }];
  const arr = pageId.split("/");

  for (let i = 0; i < arr.length; i++) {
    const bc = { name: arr[i] };
    if (i < arr.length - 1) {
      bc.link = `${ret[i].link}${arr[i]}/`;
    }
    ret.push(bc);
  }
  return ret;
}
