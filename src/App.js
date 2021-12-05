import React from "react"
import NetlifyAPI from "netlify"
import timeAgo from "time-ago"
import { csrfToken, parseHash } from "./utils/auth"
import { sortByDate, sortByPublishDate, sortByName, sortByFunctions, sortByRepo, matchText } from "./utils/sort"
import ForkMe from "./components/ForkMe"
import loginButton from "./assets/netlify-login-button.svg"
import "./App.css"
import { useProduceState } from "@swyx/hooks"

export default function App() {
  const user = parseHash(window.location.hash)
  // /* Clear hash */
  // removeHash()
  // /* Protect against csrf (cross site request forgery https://bit.ly/1V1AvZD) */
  // if (user.token && !localStorage.getItem(user.csrf)) {
  //   alert("Token invalid. Please try to login again")
  //   return <div>error</div>
  // }

  /* Clean up csrfToken */
  localStorage.removeItem(user.csrf)
  const [state, setState] = useProduceState({
    sites: [],
    filterText: "",
    loading: false,
    sortBy: "published_at",
    sortOrder: "desc"
  })

  const clientRef = React.useRef(null)
  React.useEffect(() => {
    async function abc() {
      if (!user.token) {
        console.error("something bad happened, no user token", user)
        return
      }

      /* Set request loading state */
      setState(draft => void (draft.loading = true))

      /* Fetch sites from netlify API */
      const client = new NetlifyAPI(window.atob(user.token))
      clientRef.current = client
      const sites = await client.listSites({ filter: "all" })

      /* Set sites and turn off loading state */
      setState(draft => {
        draft.sites = sites
        draft.loading = false
      })
    }
    abc()
  }, [])
  const deleteSite = id => e => {
    const ans = true // window.confirm("delete site " + id)
    if (ans) {
      fetch("https://api.netlify.com/api/v1/sites/" + id, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${clientRef.current.accessToken}`
        }
      }).then(() =>
        setState(draft => {
          draft.sites = state.sites.filter(x => x.id !== id)
        })
      )
    }
  }
  const handleAuth = e => {
    e.preventDefault()
    const csrf = csrfToken()
    const { location, localStorage } = window
    /* Set csrf token */
    localStorage.setItem(csrf, "true")
    /* Do redirect */
    const redirectTo = `${location.origin}${location.pathname}`
    window.location.href = `/.netlify/functions/auth-start?csrf=${csrf}&url=${redirectTo}`
  }
  const handleLogout = e => {
    e.preventDefault()
    window.location.href = `/`
  }
  const handleFilterInput = ({ target }) => {
    setState(draft => void (draft.filterText = target.value))
  }
  const handleSort = ({ target }) => {
    const { sortOrder } = state
    if (target && target.dataset) {
      setState(draft => {
        draft.sortBy = target.dataset.sort
        // invert sort order
        draft.sortOrder = sortOrder === "desc" ? "asc" : "desc"
      })
    }
  }
  const renderSiteList = () => {
    const { sites, filterText, loading, sortBy, sortOrder } = state
    console.log({ sites })
    if (loading || !sites) {
      return <div>Loading sites...</div>
    }

    let order
    if (sortBy === "published_at") {
      order = sortByPublishDate(sortOrder)
    } else if (sortBy === "name" || sortBy === "account_name") {
      order = sortByName(sortBy, sortOrder)
    } else if (sortBy === "updated_at" || sortBy === "created_at") {
      order = sortByDate(sortBy, sortOrder)
    } else if (sortBy === "functions") {
      order = sortByFunctions(sortOrder)
    } else if (sortBy === "repo") {
      order = sortByRepo(sortOrder)
    }

    const sortedSites = sites.sort(order)

    let matchingSites = sortedSites
      .filter(site => {
        // No search query. Show all
        if (!filterText) {
          return true
        }

        const { name, site_id, ssl_url, build_settings, account_name } = site
        if (
          matchText(filterText, name) ||
          matchText(filterText, site_id) ||
          matchText(filterText, ssl_url) ||
          matchText(filterText, account_name)
        ) {
          return true
        }

        // Matches repo url
        if (build_settings && build_settings.repo_url && matchText(filterText, build_settings.repo_url)) {
          return true
        }

        // no match!
        return false
      })
      .map((site, i) => {
        const { name, account_name, account_slug, admin_url, ssl_url, screenshot_url, created_at } = site
        const published_deploy = site.published_deploy || {}
        const functions = published_deploy.available_functions || []
        const functionsNames = functions.map(func => func.n).join(", ")
        const build_settings = site.build_settings || {}
        const { repo_url } = build_settings
        const time = published_deploy.published_at
          ? timeAgo.ago(new Date(published_deploy.published_at).getTime())
          : "NA"
        const createdAt = created_at ? timeAgo.ago(new Date(created_at).getTime()) : "NA"
        return (
          <div className="site-wrapper" key={i}>
            <button onClick={deleteSite(site.id)}>X</button>
            <div className="site-screenshot">
              <a href={admin_url} target="_blank" rel="noopener noreferrer">
                <img src={screenshot_url} alt="" />
              </a>
            </div>
            <div className="site-info">
              <h2>
                <a href={admin_url} target="_blank" rel="noopener noreferrer">
                  {name}
                </a>
              </h2>
              <div className="site-meta">
                <a href={ssl_url} target="_blank" rel="noopener noreferrer">
                  {ssl_url}
                </a>
              </div>
            </div>
            <div className="site-team">
              <a
                href={`https://app.netlify.com/teams/${account_slug}/sites/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {account_name}
              </a>
            </div>
            <div className="site-publish-time">{time}</div>
            <div className="site-functions">
              <div title={functionsNames}>
                <a href={`${admin_url}/functions`} target="_blank" rel="noopener noreferrer">
                  {functions.length}
                </a>
              </div>
            </div>
            <div className="site-create-time">{createdAt}</div>
            <div className="site-repo-link">
              {repo_url ? (
                <a href={repo_url} target="_blank" rel="noopener noreferrer">
                  {repo_url.replace(/^https:\/\//, "")}
                </a>
              ) : (
                ""
              )}
            </div>
          </div>
        )
      })

    if (!matchingSites.length) {
      matchingSites = (
        <div>
          <h3>No '{filterText}' examples found. Clear your search and try again.</h3>
        </div>
      )
    }
    return matchingSites
  }

  /* Not logged in. Show login button */
  if (user && !user.token) {
    return (
      <div className="app">
        <ForkMe url="https://github.com/netlify-labs/oauth-example" />
        <h1>Netlify Site Search</h1>
        <button onClick={handleAuth}>
          <img alt="login to netlify" className="login-button" src={loginButton} />
        </button>
      </div>
    )
  }

  /* Show admin UI */
  return (
    <div className="app">
      <ForkMe url="https://github.com/netlify-labs/oauth-example" />
      <h1>
        <span className="title-inner">
          Hi {user.full_name || "Friend"}
          <button className="primary-button" onClick={handleLogout}>
            Logout
          </button>
        </span>
      </h1>
      <div className="contents">
        <input
          className="search"
          onChange={handleFilterInput}
          placeholder="Search for sites by name, id, url, team, or repo"
        />
        <div className="site-wrapper-header">
          <div
            className="site-screenshot-header header"
            data-sort="name"
            onClick={handleSort}
            title="Click to sort by site name"
          >
            Site Info
          </div>
          <div className="site-info header" data-sort="name" onClick={handleSort} />
          <div
            className="site-team header"
            data-sort="account_name"
            onClick={handleSort}
            title="Click to sort by team name"
          >
            Team
          </div>
          <div
            className="site-publish-time header"
            data-sort="published_at"
            onClick={handleSort}
            title="Click to sort by last publish date"
          >
            Last published
          </div>
          <div
            className="site-functions header"
            data-sort="functions"
            onClick={handleSort}
            title="Click to sort by number of Functions"
          >
            Functions
          </div>
          <div
            className="site-create-time header"
            data-sort="created_at"
            onClick={handleSort}
            title="Click to sort by site creation date"
          >
            Created At
          </div>
          <div
            className="site-repo-link header"
            data-sort="repo"
            onClick={handleSort}
            title="Click to sort by repo link"
          >
            Repo
          </div>
        </div>
        {renderSiteList()}
      </div>
    </div>
  )
}
