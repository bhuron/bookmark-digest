import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tagsApi } from '../services/api';
import { Plus, Trash2, Edit2, FileText, X } from 'lucide-react';

export default function Tags() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({ name: '', color: '#6B7280' });

  const { data: tags, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => tagsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setShowCreateForm(false);
      setFormData({ name: '', color: '#6B7280' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => tagsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setEditingTag(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => tagsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    updateMutation.mutate({ id: editingTag.id, data: formData });
  };

  const handleEdit = (tag) => {
    setEditingTag(tag);
    setFormData({ name: tag.name, color: tag.color });
  };

  const handleDelete = (tag) => {
    if (confirm(`Delete tag "${tag.name}"? This will remove it from all articles.`)) {
      deleteMutation.mutate(tag.id);
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingTag(null);
    setFormData({ name: '', color: '#6B7280' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Tag
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingTag) && (
        <div className="card mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingTag ? 'Edit Tag' : 'Create New Tag'}
            </h3>
            <form onSubmit={editingTag ? handleUpdate : handleCreate} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label htmlFor="tagName" className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    id="tagName"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="Technology"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="tagColor" className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="tagColor"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-12 h-10 rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="input w-24"
                      pattern="^#[0-9A-Fa-f]{6}$"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {formData.name && (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: formData.color + '20',
                      color: formData.color,
                    }}
                  >
                    {formData.name}
                  </span>
                  <span className="text-sm text-gray-500">Preview</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary">
                  {editingTag ? 'Update' : 'Create'} Tag
                </button>
                <button type="button" onClick={handleCancel} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tags List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tags?.map((tag) => (
          <div key={tag.id} className="card">
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-2"
                    style={{
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                  <div className="flex items-center text-sm text-gray-500">
                    <FileText className="w-4 h-4 mr-1" />
                    {tag.article_count} articles
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tag)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/?tag=${encodeURIComponent(tag.name)}`)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                    title="View articles"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tags?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No tags yet</p>
          <p className="text-gray-400 text-sm mt-2">Create a tag to organize your articles</p>
        </div>
      )}
    </div>
  );
}
