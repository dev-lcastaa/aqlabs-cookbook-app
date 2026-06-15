import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './services/api'
import './App.css'

const MEASUREMENT_UNITS = {
  tsp: { label: 'Teaspoon', toMilliliters: 4.92892 },
  tbsp: { label: 'Tablespoon', toMilliliters: 14.7868 },
  cup: { label: 'Cup', toMilliliters: 236.588 },
  ml: { label: 'Milliliter', toMilliliters: 1 },
  l: { label: 'Liter', toMilliliters: 1000 },
}

const MASS_UNITS = {
  g: { label: 'Gram', toGrams: 1 },
  kg: { label: 'Kilogram', toGrams: 1000 },
  oz: { label: 'Ounce', toGrams: 28.3495 },
  lb: { label: 'Pound', toGrams: 453.592 },
}

function App() {
  const [activeSection, setActiveSection] = useState('home')
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

  const [measurementValue, setMeasurementValue] = useState('1')
  const [measurementFrom, setMeasurementFrom] = useState('cup')
  const [measurementTo, setMeasurementTo] = useState('ml')
  const [massValue, setMassValue] = useState('1')
  const [massFrom, setMassFrom] = useState('lb')
  const [massTo, setMassTo] = useState('g')
  const [activeToolTile, setActiveToolTile] = useState(null)
  const [ripperFiles, setRipperFiles] = useState([])
  const [ripperParsing, setRipperParsing] = useState(false)
  const [ripperDraft, setRipperDraft] = useState(null)
  const [ripperTargetCookbookId, setRipperTargetCookbookId] = useState('')

  const isInsideCookbook = selectedCookbookId !== null
  const selectedRecipe = selectedCookbook?.recipes?.find((recipe) => recipe.id === selectedRecipeId) ?? null

  const cookbookCountLabel = useMemo(() => {
    if (cookbooks.length === 1) {
      return '1 cookbook'
    }
    return `${cookbooks.length} cookbooks`
  }, [cookbooks.length])

  const measurementResult = useMemo(() => {
    const amount = Number(measurementValue)
    if (Number.isNaN(amount)) {
      return '--'
    }
    const base = amount * MEASUREMENT_UNITS[measurementFrom].toMilliliters
    const converted = base / MEASUREMENT_UNITS[measurementTo].toMilliliters
    return formatResult(converted)
  }, [measurementFrom, measurementTo, measurementValue])

  const massResult = useMemo(() => {
    const amount = Number(massValue)
    if (Number.isNaN(amount)) {
      return '--'
    }
    const base = amount * MASS_UNITS[massFrom].toGrams
    const converted = base / MASS_UNITS[massTo].toGrams
    return formatResult(converted)
  }, [massFrom, massTo, massValue])

  const ripperFilePreviews = useMemo(
    () =>
      ripperFiles.map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [ripperFiles]
  )

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

  useEffect(() => {
    return () => {
      ripperFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url))
    }
  }, [ripperFilePreviews])

  async function enterCookbook(cookbookId) {
    try {
      setLoading(true)
      setError('')
      const detail = await api.getCookbook(cookbookId)
      setActiveSection('cookbooks')
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

  function enterCookbookSection() {
    setActiveSection('cookbooks')
  }

  function enterToolsSection() {
    setActiveSection('tools')
    setActiveToolTile(null)
    resetRecipeRipper()
  }

  function returnToHome() {
    setActiveSection('home')
    setActiveToolTile(null)
    resetRecipeRipper()
    setSelectedCookbookId(null)
    setSelectedCookbook(null)
    setSelectedRecipeId(null)
    setEditingCookbook(false)
    setEditingRecipeId(null)
    setShowRecipeForm(false)
  }

  function returnToCookbookGrid() {
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

  function returnToToolList() {
    setActiveToolTile(null)
    resetRecipeRipper()
  }

  function returnToRecipeRipperList() {
    setActiveToolTile('recipe-ripper')
  }

  function resetRecipeRipper() {
    setRipperFiles([])
    setRipperDraft(null)
    setRipperParsing(false)
    setRipperTargetCookbookId('')
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
        returnToCookbookGrid()
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

  function handleRecipeRipperFileChange(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) {
      return
    }
    setError('')
    setRipperFiles((prev) => [...prev, ...files].slice(0, 5))
    event.target.value = ''
  }

  function removeRecipeRipperFile(index) {
    setRipperFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))
  }

  async function parseRecipeFromImages() {
    if (!ripperFiles.length) {
      setError('Add at least one recipe image before parsing.')
      return
    }

    try {
      setError('')
      setRipperParsing(true)
      const formData = new FormData()
      ripperFiles.forEach((file) => {
        formData.append('files', file)
      })

      const parsed = await api.parseRecipeFromImages(formData)
      setRipperDraft({
        recipe_name: parsed.recipe_name || '',
        ethnicity: parsed.ethnicity || '',
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.join('\n') : '',
        directions: parsed.directions || '',
      })

      if (selectedCookbookId) {
        setRipperTargetCookbookId(String(selectedCookbookId))
      }
    } catch (parseError) {
      setError(parseError.message)
    } finally {
      setRipperParsing(false)
    }
  }

  async function saveRippedRecipe(event) {
    event.preventDefault()
    if (!ripperDraft) {
      return
    }

    const cookbookId = Number(ripperTargetCookbookId)
    if (!cookbookId) {
      setError('Select a target cookbook before saving.')
      return
    }

    if (!ripperDraft.recipe_name.trim() || !ripperDraft.directions.trim()) {
      setError('Recipe name and directions are required before saving.')
      return
    }

    try {
      setSaving(true)
      setError('')
      await api.createRecipe({
        cookbook_id: cookbookId,
        recipe_name: ripperDraft.recipe_name.trim(),
        ethnicity: ripperDraft.ethnicity.trim() || null,
        ingredients: parseIngredients(ripperDraft.ingredients),
        directions: ripperDraft.directions.trim(),
      })

      if (selectedCookbookId === cookbookId) {
        await refreshCurrentCookbook()
      }

      returnToToolList()
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
        <h1>Cookbooks & Tools</h1>
        <p className="subtitle">Browse cookbooks, open recipes, and use quick kitchen utilities from one place.</p>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {activeSection === 'home' ? (
        <section className="panel landing-view">
          <div className="panel-topline landing-topline">
            <div>
              <h2>Main Page</h2>
              <p className="muted">Choose where you want to go.</p>
            </div>
          </div>

          <div className="landing-grid">
            <button type="button" className="landing-card" onClick={enterCookbookSection}>
              <span className="tile-icon landing-icon" aria-hidden="true">
                <BookIcon />
              </span>
              <strong>Cookbooks</strong>
              <span>{loading ? 'Loading cookbooks...' : cookbookCountLabel}</span>
            </button>

            <button type="button" className="landing-card" onClick={enterToolsSection}>
              <span className="tile-icon landing-icon" aria-hidden="true">
                <ToolIcon />
              </span>
              <strong>Tooling</strong>
              <span>Converters and utilities</span>
            </button>
          </div>
        </section>
      ) : null}

      {activeSection === 'tools' ? (
        <section className="panel tools-view">
          {activeToolTile === null ? (
            <>
              <div className="detail-head">
                <div>
                  <BackButton label="Back to Main Page" onClick={returnToHome} />
                  <h2>Kitchen Tools</h2>
                  <p>Select a tile to open a tool page.</p>
                </div>
              </div>

              <div className="tool-grid tool-tile-grid">
                <button
                  type="button"
                  className="landing-card"
                  onClick={() => setActiveToolTile('mass')}
                >
                  <span className="tile-icon landing-icon" aria-hidden="true">
                    <ScaleIcon />
                  </span>
                  <strong>Mass Converter</strong>
                  <span>Convert grams, pounds, ounces, and more</span>
                </button>

                <button
                  type="button"
                  className="landing-card"
                  onClick={() => setActiveToolTile('measurement')}
                >
                  <span className="tile-icon landing-icon" aria-hidden="true">
                    <CupIcon />
                  </span>
                  <strong>Measurement Converter</strong>
                  <span>Convert cups, tablespoons, milliliters, and more</span>
                </button>

                <button
                  type="button"
                  className="landing-card"
                  onClick={() => setActiveToolTile('recipe-ripper')}
                >
                  <span className="tile-icon landing-icon" aria-hidden="true">
                    <SparkIcon />
                  </span>
                  <strong>Recipe Ripper</strong>
                  <span>Open ripper options</span>
                </button>

                <button
                  type="button"
                  className="landing-card"
                  onClick={() => setActiveToolTile('ai-recommender')}
                >
                  <span className="tile-icon landing-icon" aria-hidden="true">
                    <BrainIcon />
                  </span>
                  <strong>AI Recommender</strong>
                  <span>Coming soon</span>
                </button>
              </div>
            </>
          ) : null}

          {activeToolTile === 'mass' ? (
            <>
              <div className="detail-head">
                <div>
                  <BackButton label="Back to Tools" onClick={returnToToolList} />
                  <h2>Mass Converter</h2>
                  <p>Convert between common kitchen mass units.</p>
                </div>
              </div>
              <article className="tool-card tool-detail-card">
                <div className="converter-grid">
                  <label>
                    Amount
                    <input
                      value={massValue}
                      onChange={(event) => setMassValue(event.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    From
                    <select value={massFrom} onChange={(event) => setMassFrom(event.target.value)}>
                      {Object.entries(MASS_UNITS).map(([value, unit]) => (
                        <option key={value} value={value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To
                    <select value={massTo} onChange={(event) => setMassTo(event.target.value)}>
                      {Object.entries(MASS_UNITS).map(([value, unit]) => (
                        <option key={value} value={value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="converter-result">Result: {massResult} {massTo}</p>
              </article>
            </>
          ) : null}

          {activeToolTile === 'measurement' ? (
            <>
              <div className="detail-head">
                <div>
                  <BackButton label="Back to Tools" onClick={returnToToolList} />
                  <h2>Measurement Converter</h2>
                  <p>Convert between common kitchen volume units.</p>
                </div>
              </div>
              <article className="tool-card tool-detail-card">
                <div className="converter-grid">
                  <label>
                    Amount
                    <input
                      value={measurementValue}
                      onChange={(event) => setMeasurementValue(event.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    From
                    <select value={measurementFrom} onChange={(event) => setMeasurementFrom(event.target.value)}>
                      {Object.entries(MEASUREMENT_UNITS).map(([value, unit]) => (
                        <option key={value} value={value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To
                    <select value={measurementTo} onChange={(event) => setMeasurementTo(event.target.value)}>
                      {Object.entries(MEASUREMENT_UNITS).map(([value, unit]) => (
                        <option key={value} value={value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="converter-result">Result: {measurementResult} {measurementTo}</p>
              </article>
            </>
          ) : null}

          {activeToolTile === 'recipe-ripper' ? (
            <>
              <div className="detail-head">
                <div>
                  <BackButton label="Back to Tools" onClick={returnToToolList} />
                  <h2>Recipe Ripper</h2>
                  <p>Select how you want to rip a recipe.</p>
                </div>
              </div>
              <div className="tool-grid tool-tile-grid">
                <button
                  type="button"
                  className="landing-card"
                  onClick={() => setActiveToolTile('social-recipe-ripper')}
                >
                  <span className="tile-icon landing-icon" aria-hidden="true">
                    <SparkIcon />
                  </span>
                  <strong>Social Media Recipe Ripper</strong>
                  <span>Extract from social recipe posts and captions</span>
                </button>

                <button
                  type="button"
                  className="landing-card"
                  onClick={() => setActiveToolTile('photo-recipe-ripper')}
                >
                  <span className="tile-icon landing-icon" aria-hidden="true">
                    <PageIcon />
                  </span>
                  <strong>Photo Recipe Ripper</strong>
                  <span>Extract from recipe photos and handwritten notes</span>
                </button>
              </div>
            </>
          ) : null}

          {activeToolTile === 'social-recipe-ripper' ? (
            <>
              <div className="detail-head">
                <div>
                  <BackButton label="Back to Recipe Ripper" onClick={returnToRecipeRipperList} />
                  <h2>Social Media Recipe Ripper</h2>
                  <p>This flow is planned but not available yet.</p>
                </div>
              </div>
              <article className="tool-card tool-detail-card">
                <p className="empty-copy">Social Media Recipe Ripper is coming soon.</p>
              </article>
            </>
          ) : null}

          {activeToolTile === 'photo-recipe-ripper' ? (
            <>
              <div className="detail-head">
                <div>
                  <BackButton label="Back to Recipe Ripper" onClick={returnToRecipeRipperList} />
                  <h2>Photo Recipe Ripper</h2>
                  <p>Upload recipe photos, parse with AI, review, and save to a cookbook.</p>
                </div>
              </div>
              <article className="tool-card tool-detail-card">
                {!ripperDraft ? (
                  <div className="ripper-upload-flow">
                    <div className="ripper-upload-zone">
                      <strong>Take or upload recipe photos</strong>
                      <span>Add up to 5 images (JPG, PNG, WEBP, or HEIC).</span>
                      <div className="ripper-upload-actions">
                        <label htmlFor="ripper-camera-input" className="ripper-upload-choice">
                          Take Photo
                        </label>
                        <label htmlFor="ripper-file-input" className="ripper-upload-choice">
                          Upload
                        </label>
                      </div>
                    </div>
                    <input
                      id="ripper-camera-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handleRecipeRipperFileChange}
                    />
                    <input
                      id="ripper-file-input"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleRecipeRipperFileChange}
                    />

                    {ripperFiles.length ? (
                      <ul className="ripper-file-list">
                        {ripperFilePreviews.map((preview, index) => (
                          <li key={preview.id}>
                            <img src={preview.url} alt={preview.name} className="ripper-file-thumb" />
                            <span>{preview.name}</span>
                            <button type="button" className="danger-link" onClick={() => removeRecipeRipperFile(index)}>
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="empty-copy">No images selected.</p>
                    )}

                    <div className="row-actions">
                      <button type="button" onClick={parseRecipeFromImages} disabled={ripperParsing || saving || !ripperFiles.length}>
                        {ripperParsing ? 'Parsing...' : 'Parse Recipe'}
                      </button>
                      {ripperFiles.length ? (
                        <button type="button" onClick={resetRecipeRipper} disabled={ripperParsing || saving}>
                          Reset
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <form className="form-block" onSubmit={saveRippedRecipe}>
                    <label>
                      Recipe Name
                      <input
                        value={ripperDraft.recipe_name}
                        onChange={(event) =>
                          setRipperDraft((prev) => ({ ...prev, recipe_name: event.target.value }))
                        }
                      />
                    </label>

                    <label>
                      Target Cookbook
                      <select
                        value={ripperTargetCookbookId}
                        onChange={(event) => setRipperTargetCookbookId(event.target.value)}
                      >
                        <option value="">Select a cookbook</option>
                        {cookbooks.map((cookbook) => (
                          <option key={cookbook.id} value={cookbook.id}>
                            {cookbook.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Ethnicity (optional)
                      <input
                        value={ripperDraft.ethnicity}
                        onChange={(event) =>
                          setRipperDraft((prev) => ({ ...prev, ethnicity: event.target.value }))
                        }
                      />
                    </label>

                    <label>
                      Ingredients (one per line)
                      <textarea
                        value={ripperDraft.ingredients}
                        onChange={(event) =>
                          setRipperDraft((prev) => ({ ...prev, ingredients: event.target.value }))
                        }
                        rows={5}
                      />
                    </label>

                    <label>
                      Directions
                      <textarea
                        value={ripperDraft.directions}
                        onChange={(event) =>
                          setRipperDraft((prev) => ({ ...prev, directions: event.target.value }))
                        }
                        rows={6}
                      />
                    </label>

                    <div className="row-actions">
                      <button type="submit" disabled={saving || ripperParsing}>
                        {saving ? 'Saving...' : 'Save Recipe'}
                      </button>
                      <button type="button" onClick={resetRecipeRipper} disabled={saving || ripperParsing}>
                        Start Over
                      </button>
                    </div>
                  </form>
                )}
              </article>
            </>
          ) : null}

          {activeToolTile === 'ai-recommender' ? (
            <>
              <div className="detail-head">
                <div>
                  <BackButton label="Back to Tools" onClick={returnToToolList} />
                  <h2>AI Recommender</h2>
                  <p>This tool is planned but not available yet.</p>
                </div>
              </div>
              <article className="tool-card tool-detail-card">
                <p className="empty-copy">AI Recommender is coming soon.</p>
              </article>
            </>
          ) : null}
        </section>
      ) : null}

      {activeSection === 'cookbooks' && !isInsideCookbook ? (
        <section className="panel home-view">
          <div className="panel-topline">
            <div>
              <BackButton label="Back to Main Page" onClick={returnToHome} />
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
        </section>
      ) : null}

      {activeSection === 'cookbooks' && selectedRecipe ? (
        <section className="panel recipe-detail-view">
          <div className="detail-head">
            <div>
              <BackButton label="Back to Recipes" onClick={returnToRecipes} />
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
      ) : null}

      {activeSection === 'cookbooks' && isInsideCookbook && !selectedRecipe ? (
        <section className="panel cookbook-view">
          <div className="detail-head">
            <div>
              <BackButton label="Back to Cookbooks" onClick={returnToCookbookGrid} />
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
      ) : null}
    </div>
  )
}

function formatResult(value) {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '--'
}

function BackButton({ label, onClick }) {
  return (
    <button type="button" className="back-button" onClick={onClick}>
      <span className="back-icon" aria-hidden="true">
        <ArrowLeftIcon />
      </span>
      <span>{label}</span>
    </button>
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

function ArrowLeftIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
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

function ToolIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.86L4 17.46V20h2.54l5.3-5.3a4 4 0 0 0 5.86-5.4l-3.22 3.22-2.48-2.48z" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9.5 4a3.5 3.5 0 0 0-3.43 4.19A3.5 3.5 0 0 0 7 15v1a3 3 0 0 0 3 3" />
      <path d="M14.5 4a3.5 3.5 0 0 1 3.43 4.19A3.5 3.5 0 0 1 17 15v1a3 3 0 0 1-3 3" />
      <path d="M12 4v16" />
      <path d="M9 9.5h3" />
      <path d="M12 14.5h3" />
    </svg>
  )
}

function CupIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 7h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5z" />
      <path d="M15 8h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 20h6" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v4" />
      <path d="M7 8h10" />
      <path d="M9 8 5.5 14h7z" />
      <path d="m15 8 3.5 6h-7z" />
      <path d="M4 20h16" />
    </svg>
  )
}

export default App
