import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './services/api'
import './App.css'

function App() {
  const [cookbooks, setCookbooks] = useState([])
  const [selectedCookbookId, setSelectedCookbookId] = useState(null)
  const [selectedCookbook, setSelectedCookbook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [newCookbook, setNewCookbook] = useState({ name: '', ethnicity: '' })
  const [editingCookbook, setEditingCookbook] = useState(false)
  const [cookbookDraft, setCookbookDraft] = useState({ name: '', ethnicity: '' })

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

  const hasSelection = selectedCookbookId !== null

  const cookbookCountLabel = useMemo(() => {
    if (cookbooks.length === 1) {
      return '1 cookbook'
    }
    return `${cookbooks.length} cookbooks`
  }, [cookbooks.length])

  const loadCookbooks = useCallback(async (preferredId) => {
    try {
      setLoading(true)
      setError('')
      const list = await api.listCookbooks()
      setCookbooks(list)

      const nextId =
        preferredId ??
        (selectedCookbookId && list.some((cb) => cb.id === selectedCookbookId)
          ? selectedCookbookId
          : list[0]?.id ?? null)

      setSelectedCookbookId(nextId)

      if (nextId !== null) {
        const detail = await api.getCookbook(nextId)
        setSelectedCookbook(detail)
      } else {
        setSelectedCookbook(null)
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

  async function selectCookbook(cookbookId) {
    try {
      setLoading(true)
      setError('')
      setSelectedCookbookId(cookbookId)
      const detail = await api.getCookbook(cookbookId)
      setSelectedCookbook(detail)
      setEditingCookbook(false)
      setEditingRecipeId(null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
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
      await loadCookbooks(created.id)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
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
      await loadCookbooks(selectedCookbookId)
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
      await loadCookbooks()
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
      await loadCookbooks(selectedCookbookId)
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
      await loadCookbooks(selectedCookbookId)
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
      await loadCookbooks(selectedCookbookId)
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

  return (
    <div className="app-shell">
      <header className="header">
        <p className="eyebrow">AQLabs Kitchen</p>
        <h1>Cookbooks & Recipes</h1>
        <p className="subtitle">Create, organize, and browse recipes by cookbook and ethnicity.</p>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="layout">
        <aside className="panel left-panel">
          <div className="panel-topline">
            <h2>Cookbooks</h2>
            <span>{cookbookCountLabel}</span>
          </div>

          <form className="form-block" onSubmit={handleCreateCookbook}>
            <label>
              Name
              <input
                value={newCookbook.name}
                onChange={(event) => setNewCookbook((prev) => ({ ...prev, name: event.target.value }))}
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
              {saving ? 'Saving...' : 'Create Cookbook'}
            </button>
          </form>

          <div className="cookbook-list">
            {loading ? <p className="muted">Loading cookbooks...</p> : null}
            {!loading && cookbooks.length === 0 ? <p className="muted">No cookbooks yet.</p> : null}

            {cookbooks.map((cookbook) => (
              <article
                key={cookbook.id}
                className={`cookbook-card ${selectedCookbookId === cookbook.id ? 'active' : ''}`}
              >
                <button type="button" className="card-main" onClick={() => selectCookbook(cookbook.id)}>
                  <strong>{cookbook.name}</strong>
                  <span>{cookbook.ethnicity}</span>
                </button>
                <button
                  type="button"
                  className="danger-link"
                  onClick={() => handleDeleteCookbook(cookbook.id)}
                  disabled={saving}
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        </aside>

        <main className="panel right-panel">
          {!hasSelection ? (
            <div className="empty-state">
              <h2>Select or create a cookbook</h2>
              <p>Your recipes will appear here once a cookbook is selected.</p>
            </div>
          ) : (
            <>
              <div className="detail-head">
                <div>
                  <h2>{selectedCookbook?.name}</h2>
                  <p>
                    Ethnicity: <strong>{selectedCookbook?.ethnicity}</strong>
                  </p>
                </div>
                <button type="button" onClick={startEditingCookbook} disabled={saving || loading}>
                  Edit Cookbook
                </button>
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

              <section className="recipe-section">
                <div className="panel-topline">
                  <h3>Recipes</h3>
                  <span>{selectedCookbook?.recipes?.length || 0} total</span>
                </div>

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
                    {saving ? 'Saving...' : 'Add Recipe'}
                  </button>
                </form>

                <div className="recipe-list">
                  {selectedCookbook?.recipes?.length ? null : (
                    <p className="muted">No recipes in this cookbook yet.</p>
                  )}

                  {selectedCookbook?.recipes?.map((recipe) => (
                    <article className="recipe-card" key={recipe.id}>
                      {editingRecipeId === recipe.id ? (
                        <form className="form-block inline-edit" onSubmit={(event) => handleUpdateRecipe(event, recipe.id)}>
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
                        <>
                          <div className="recipe-title">
                            <h4>{recipe.recipe_name}</h4>
                            <span>{recipe.ethnicity}</span>
                          </div>
                          <h5>Ingredients</h5>
                          <ul>
                            {recipe.ingredients.map((item, index) => (
                              <li key={`${recipe.id}-${index}`}>{item}</li>
                            ))}
                          </ul>
                          <h5>Directions</h5>
                          <p>{recipe.directions}</p>
                          <div className="row-actions">
                            <button type="button" onClick={() => startEditingRecipe(recipe)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger-link"
                              onClick={() => handleDeleteRecipe(recipe.id)}
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function parseIngredients(value) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export default App
