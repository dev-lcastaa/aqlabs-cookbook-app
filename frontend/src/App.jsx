import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './services/api'
import './App.css'

function App() {
  const [cookbooks, setCookbooks] = useState([])
  const [selectedCookbookId, setSelectedCookbookId] = useState(null)
  const [selectedCookbook, setSelectedCookbook] = useState(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showCookbookForm, setShowCookbookForm] = useState(false)
  const [newCookbook, setNewCookbook] = useState({ name: '', ethnicity: '' })
  const [editingCookbook, setEditingCookbook] = useState(false)
  const [cookbookDraft, setCookbookDraft] = useState({ name: '', ethnicity: '' })

  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [newRecipe, setNewRecipe] = useState({
    recipe_name: '',
    ethnicity: '',
    ingredients: '',
    directions: '',
  })
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [recipeDraft, setRecipeDraft] = useState({
    recipe_name: '',
    ethnicity: '',
    ingredients: '',
    directions: '',
  })

  const isInsideCookbook = selectedCookbookId !== null
  const selectedRecipe = selectedCookbook?.recipes?.find((recipe) => recipe.id === selectedRecipeId) ?? null

  const cookbookCountLabel = useMemo(() => {
    if (cookbooks.length === 1) {
      return '1 cookbook'
    }
    return `${cookbooks.length} cookbooks`
  }, [cookbooks.length])

  const loadCookbooks = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const list = await api.listCookbooks()
      setCookbooks(list)

      if (selectedCookbookId && !list.some((cb) => cb.id === selectedCookbookId)) {
        setSelectedCookbookId(null)
        setSelectedCookbook(null)
        setSelectedRecipeId(null)
      }
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [selectedCookbookId])

  useEffect(() => {
    // Initial API bootstrap for cookbook data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCookbooks()
  }, [loadCookbooks])

  async function enterCookbook(cookbookId) {
    try {
      setLoading(true)
      setError('')
      const detail = await api.getCookbook(cookbookId)
      setSelectedCookbookId(cookbookId)
      setSelectedCookbook(detail)
      setSelectedRecipeId(null)
      setEditingCookbook(false)
      setEditingRecipeId(null)
      setShowRecipeForm(false)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  function returnToCookbooks() {
    setSelectedCookbookId(null)
    setSelectedCookbook(null)
    setSelectedRecipeId(null)
    setEditingCookbook(false)
    setEditingRecipeId(null)
    setShowRecipeForm(false)
  }

  function returnToRecipes() {
    setSelectedRecipeId(null)
    setEditingRecipeId(null)
  }

  async function refreshCurrentCookbook() {
    if (!selectedCookbookId) {
      return
    }
    const detail = await api.getCookbook(selectedCookbookId)
    setSelectedCookbook(detail)
    if (selectedRecipeId && !detail.recipes.some((recipe) => recipe.id === selectedRecipeId)) {
      setSelectedRecipeId(null)
    }
  }

  async function handleCreateCookbook(event) {
    event.preventDefault()
    if (!newCookbook.name.trim() || !newCookbook.ethnicity.trim()) {
      setError('Cookbook name and ethnicity are required.')
      return
    }

    try {
      setSaving(true)
      setError('')
      const created = await api.createCookbook({
        name: newCookbook.name.trim(),
        ethnicity: newCookbook.ethnicity.trim(),
      })
      setNewCookbook({ name: '', ethnicity: '' })
      setShowCookbookForm(false)
      await loadCookbooks()
      await enterCookbook(created.id)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCookbook(cookbookId) {
    try {
      setSaving(true)
      setError('')
      await api.deleteCookbook(cookbookId)
      if (selectedCookbookId === cookbookId) {
        returnToCookbooks()
      }
      await loadCookbooks()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function startEditingCookbook() {
    if (!selectedCookbook) {
      return
    }
    setEditingCookbook(true)
    setCookbookDraft({
      name: selectedCookbook.name,
      ethnicity: selectedCookbook.ethnicity,
    })
  }

  async function handleUpdateCookbook(event) {
    event.preventDefault()
    if (!selectedCookbookId) {
      return
    }

    try {
      setSaving(true)
      setError('')
      await api.updateCookbook(selectedCookbookId, {
        name: cookbookDraft.name.trim(),
        ethnicity: cookbookDraft.ethnicity.trim(),
      })
      setEditingCookbook(false)
      await loadCookbooks()
      await refreshCurrentCookbook()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateRecipe(event) {
    event.preventDefault()
    if (!selectedCookbookId) {
      return
    }

    try {
      setSaving(true)
      setError('')
      await api.createRecipe({
        cookbook_id: selectedCookbookId,
        recipe_name: newRecipe.recipe_name.trim(),
        ethnicity: newRecipe.ethnicity.trim() || null,
        ingredients: parseIngredients(newRecipe.ingredients),
        directions: newRecipe.directions.trim(),
      })
      setNewRecipe({ recipe_name: '', ethnicity: '', ingredients: '', directions: '' })
      setShowRecipeForm(false)
      await refreshCurrentCookbook()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function startEditingRecipe(recipe) {
    setEditingRecipeId(recipe.id)
    setRecipeDraft({
      recipe_name: recipe.recipe_name,
      ethnicity: recipe.ethnicity,
      ingredients: recipe.ingredients.join('\n'),
      directions: recipe.directions,
    })
  }

  async function handleUpdateRecipe(event, recipeId) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      await api.updateRecipe(recipeId, {
        recipe_name: recipeDraft.recipe_name.trim(),
        ethnicity: recipeDraft.ethnicity.trim(),
        ingredients: parseIngredients(recipeDraft.ingredients),
        directions: recipeDraft.directions.trim(),
      })
      setEditingRecipeId(null)
      await refreshCurrentCookbook()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRecipe(recipeId) {
    try {
      setSaving(true)
      setError('')
      await api.deleteRecipe(recipeId)
      if (selectedRecipeId === recipeId) {
        setSelectedRecipeId(null)
      }
      await refreshCurrentCookbook()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="header">
        <p className="eyebrow">AQLabs Kitchen</p>
        <h1>Cookbooks & Recipes</h1>
        <p className="subtitle">Track your cookbooks and open one to manage its recipes.</p>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {!isInsideCookbook ? (
        <section className="panel home-view">
          <div className="panel-topline">
            <div>
              <h2>Cookbooks</h2>
              <p className="muted">{loading ? 'Loading...' : cookbookCountLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCookbookForm((prev) => !prev)}
              disabled={saving}
            >
              {showCookbookForm ? 'Close' : 'Create Cookbook'}
            </button>
          </div>

          {showCookbookForm ? (
            <form className="form-block" onSubmit={handleCreateCookbook}>
              <label>
                Name
                <input
                  value={newCookbook.name}
                  onChange={(event) =>
                    setNewCookbook((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Street Food Essentials"
                />
              </label>
              <label>
                Ethnicity
                <input
                  value={newCookbook.ethnicity}
                  onChange={(event) =>
                    setNewCookbook((prev) => ({ ...prev, ethnicity: event.target.value }))
                  }
                  placeholder="Thai"
                />
              </label>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Cookbook'}
              </button>
            </form>
          ) : null}

          {!loading && cookbooks.length === 0 ? <p className="empty-copy">No cookbooks</p> : null}

          <div className="cookbook-grid">
            {cookbooks.map((cookbook) => (
              <button
                type="button"
                className="cookbook-grid-card tile-button"
                key={cookbook.id}
                onClick={() => enterCookbook(cookbook.id)}
              >
                <span className="tile-heading">
                  <span className="tile-icon" aria-hidden="true">
                    <BookIcon />
                  </span>
                  <strong>{cookbook.name}</strong>
                </span>
              </button>
            ))}
          </div>

          {selectedCookbookId ? null : cookbooks.length === 0 ? null : (
            <div className="action-bar">
              <p className="muted">Select a cookbook tile to manage it.</p>
            </div>
          )}
        </section>
      ) : selectedRecipe ? (
        <section className="panel recipe-detail-view">
          <div className="detail-head">
            <div>
              <button type="button" className="ghost-link" onClick={returnToRecipes}>
                Back to Recipes
              </button>
              <h2>{selectedRecipe.recipe_name}</h2>
              <p>
                Ethnicity: <strong>{selectedRecipe.ethnicity}</strong>
              </p>
            </div>
          </div>

          {editingRecipeId === selectedRecipe.id ? (
            <form className="form-block inline-edit" onSubmit={(event) => handleUpdateRecipe(event, selectedRecipe.id)}>
              <label>
                Recipe Name
                <input
                  value={recipeDraft.recipe_name}
                  onChange={(event) =>
                    setRecipeDraft((prev) => ({ ...prev, recipe_name: event.target.value }))
                  }
                />
              </label>
              <label>
                Ethnicity
                <input
                  value={recipeDraft.ethnicity}
                  onChange={(event) =>
                    setRecipeDraft((prev) => ({ ...prev, ethnicity: event.target.value }))
                  }
                />
              </label>
              <label>
                Ingredients
                <textarea
                  value={recipeDraft.ingredients}
                  onChange={(event) =>
                    setRecipeDraft((prev) => ({ ...prev, ingredients: event.target.value }))
                  }
                  rows={4}
                />
              </label>
              <label>
                Directions
                <textarea
                  value={recipeDraft.directions}
                  onChange={(event) =>
                    setRecipeDraft((prev) => ({ ...prev, directions: event.target.value }))
                  }
                  rows={5}
                />
              </label>
              <div className="row-actions">
                <button type="submit" disabled={saving}>
                  Save
                </button>
                <button type="button" onClick={() => setEditingRecipeId(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="recipe-detail-card">
              <h3>Ingredients</h3>
              <ul>
                {selectedRecipe.ingredients.map((item, index) => (
                  <li key={`${selectedRecipe.id}-${index}`}>{item}</li>
                ))}
              </ul>
              <h3>Directions</h3>
              <p>{selectedRecipe.directions}</p>
            </div>
          )}

          <div className="action-bar">
            <button type="button" onClick={() => startEditingRecipe(selectedRecipe)} disabled={saving}>
              Edit Recipe
            </button>
            <button
              type="button"
              className="danger-link"
              onClick={() => handleDeleteRecipe(selectedRecipe.id)}
              disabled={saving}
            >
              Delete Recipe
            </button>
          </div>
        </section>
      ) : (
        <section className="panel cookbook-view">
          <div className="detail-head">
            <div>
              <button type="button" className="ghost-link" onClick={returnToCookbooks}>
                Back to Cookbooks
              </button>
              <h2>{selectedCookbook?.name}</h2>
              <p>
                Ethnicity: <strong>{selectedCookbook?.ethnicity}</strong>
              </p>
            </div>
          </div>

          {editingCookbook ? (
            <form className="form-block inline-edit" onSubmit={handleUpdateCookbook}>
              <label>
                Name
                <input
                  value={cookbookDraft.name}
                  onChange={(event) =>
                    setCookbookDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </label>
              <label>
                Ethnicity
                <input
                  value={cookbookDraft.ethnicity}
                  onChange={(event) =>
                    setCookbookDraft((prev) => ({ ...prev, ethnicity: event.target.value }))
                  }
                />
              </label>
              <div className="row-actions">
                <button type="submit" disabled={saving}>
                  Save
                </button>
                <button type="button" onClick={() => setEditingCookbook(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <div className="panel-topline recipe-topline">
            <div>
              <h3>Recipes</h3>
              <p className="muted">{selectedCookbook?.recipes?.length || 0} total</p>
            </div>
            <button type="button" onClick={() => setShowRecipeForm((prev) => !prev)}>
              {showRecipeForm ? 'Close' : 'Add Recipe'}
            </button>
          </div>

          {showRecipeForm ? (
            <form className="form-block" onSubmit={handleCreateRecipe}>
              <label>
                Recipe Name
                <input
                  value={newRecipe.recipe_name}
                  onChange={(event) =>
                    setNewRecipe((prev) => ({ ...prev, recipe_name: event.target.value }))
                  }
                  placeholder="Tom Yum Soup"
                />
              </label>
              <label>
                Ethnicity (optional)
                <input
                  value={newRecipe.ethnicity}
                  onChange={(event) =>
                    setNewRecipe((prev) => ({ ...prev, ethnicity: event.target.value }))
                  }
                  placeholder="Defaults to cookbook ethnicity"
                />
              </label>
              <label>
                Ingredients (one per line)
                <textarea
                  value={newRecipe.ingredients}
                  onChange={(event) =>
                    setNewRecipe((prev) => ({ ...prev, ingredients: event.target.value }))
                  }
                  rows={4}
                />
              </label>
              <label>
                Directions
                <textarea
                  value={newRecipe.directions}
                  onChange={(event) =>
                    setNewRecipe((prev) => ({ ...prev, directions: event.target.value }))
                  }
                  rows={5}
                />
              </label>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Recipe'}
              </button>
            </form>
          ) : null}

          <div className="recipe-list">
            {selectedCookbook?.recipes?.length ? null : <p className="empty-copy">No recipes</p>}

            {selectedCookbook?.recipes?.map((recipe) => (
              <button
                type="button"
                className="recipe-card tile-button"
                key={recipe.id}
                onClick={() => setSelectedRecipeId(recipe.id)}
              >
                <span className="tile-heading">
                  <span className="tile-icon" aria-hidden="true">
                    <PageIcon />
                  </span>
                  <strong>{recipe.recipe_name}</strong>
                </span>
              </button>
            ))}
          </div>

          <div className="action-bar">
            <button type="button" onClick={startEditingCookbook} disabled={saving || loading}>
              Edit Cookbook
            </button>
            <button
              type="button"
              className="danger-link"
              onClick={() => handleDeleteCookbook(selectedCookbookId)}
              disabled={saving}
            >
              Delete Cookbook
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function parseIngredients(value) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function BookIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15.5a.5.5 0 0 1-.5.5H7a3 3 0 1 1 0-6h13" />
      <path d="M8 8h8" />
      <path d="M8 12h6" />
    </svg>
  )
}

function PageIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9A2.5 2.5 0 0 0 19 18.5V8z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13H15" />
      <path d="M8.5 16H15" />
    </svg>
  )
}

export default App
