"""Starter 3D pieces for VYUHA — made in code, so no image-to-3D credits are needed.

    pip install trimesh numpy shapely matplotlib mapbox_earcut manifold3d
    python3 tools/make-pieces-3d.py

Writes, for each of the ten pieces:
    assets/3d/glb/<slug>_surya.glb     brass, for renders / a future 3D table (metres)
    assets/3d/glb/<slug>_chandra.glb   silver-indigo
    assets/3d/stl/<slug>.stl           for 3D printing a physical prototype (millimetres)
and a contact sheet at assets/3d/preview.png.

Every piece stands on the same 28 mm base (a standard miniature base) and has its own
silhouette on top, so the set reads at a glance on a real table. These are deliberately
simple — a clean starting point to refine in Blender, or to print and playtest the
physical board game. See docs/prompts/3D.md.
"""
import math
import os

import numpy as np
import trimesh
from shapely.geometry import Polygon, Point
from shapely import affinity

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', '3d')

BASE_R = 14.0       # 28 mm base
SECTIONS = 72


def lathe(profile, sections=SECTIONS):
    """Revolve a (radius, height) profile around the Z axis. The profile runs
    from the axis at the bottom to the axis at the top, so the solid is closed."""
    return trimesh.creation.revolve(np.array(profile, dtype=float), sections=sections)


def body(h):
    """The shared column: a stepped base, a waist and a collar at height h."""
    return lathe([
        (0, 0), (BASE_R, 0), (BASE_R, 2.4), (BASE_R - 1.2, 3.2), (BASE_R - 1.6, 4.4),
        (10.0, 5.2), (8.2, 7.0), (6.2, 10.0), (5.0, h * 0.55), (5.4, h * 0.82),
        (7.6, h * 0.88), (7.6, h * 0.94), (5.6, h), (0, h)
    ])


def extrude(poly, thickness, z, upright=True):
    """Extrude a 2D outline and stand it up in the XZ plane at height z."""
    m = trimesh.creation.extrude_polygon(poly, thickness)
    m.apply_translation([0, 0, -thickness / 2])
    if upright:
        m.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    m.apply_translation([0, 0, z])
    return m


def wheel(r, z, spokes=8, tube=1.1, upright=True):
    parts = [trimesh.creation.torus(major_radius=r, minor_radius=tube, major_sections=64, minor_sections=16)]
    parts.append(trimesh.creation.cylinder(radius=tube * 1.5, height=tube * 3, sections=24))
    for i in range(spokes):
        a = 2 * math.pi * i / spokes
        s = trimesh.creation.cylinder(radius=tube * 0.55, height=r * 2, sections=12)
        s.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
        s.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
        parts.append(s)
    w = trimesh.util.concatenate(parts)
    if upright:
        w.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    w.apply_translation([0, 0, z + r])
    return w


def cone(r, h, at, direction):
    c = trimesh.creation.cone(radius=r, height=h, sections=24)
    d = np.array(direction, dtype=float)
    d /= np.linalg.norm(d)
    z = np.array([0, 0, 1.0])
    axis = np.cross(z, d)
    if np.linalg.norm(axis) > 1e-9:
        ang = math.acos(max(-1, min(1, float(np.dot(z, d)))))
        c.apply_transform(trimesh.transformations.rotation_matrix(ang, axis))
    elif d[2] < 0:
        c.apply_transform(trimesh.transformations.rotation_matrix(math.pi, [1, 0, 0]))
    c.apply_translation(at)
    return c


def sphere(r, at):
    s = trimesh.creation.icosphere(subdivisions=3, radius=r)
    s.apply_translation(at)
    return s


# ── the ten pieces ─────────────────────────────────────────────────────────

def senapati():
    h = 40
    parts = [body(h)]
    parts.append(lathe([(0, h), (7.8, h), (8.6, h + 3), (0, h + 3)]))          # crown band
    for i in range(8):
        a = 2 * math.pi * i / 8
        parts.append(cone(1.5, 6.5, [math.cos(a) * 7.2, math.sin(a) * 7.2, h + 3 + 3.25], [0, 0, 1]))
    parts.append(sphere(3.0, [0, 0, h + 7]))                                    # the sun bindu
    parts.append(cone(1.2, 5, [0, 0, h + 12], [0, 0, 1]))
    return parts


def maharathi():
    h = 36
    return [body(h), wheel(8.5, h - 1.5, spokes=12, tube=1.2)]


def ashvarohi():
    h = 30
    head = Polygon([(-4, 0), (6, 0), (6.5, 6), (5, 11), (8, 14), (11, 17), (10.5, 19), (6, 18.5),
                    (2.5, 21), (-1, 20), (-4, 16), (-6, 10), (-5.5, 4)])
    mane = Polygon([(-4, 16), (-8, 13), (-9, 7), (-6, 4), (-5.5, 10)])
    return [body(h), extrude(head.union(mane), 6.5, h - 0.5)]


def dhanurdhar():
    h = 32
    outer = Point(0, 0).buffer(12, 64)
    inner = Point(-2.2, 0).buffer(10.4, 64)
    bow = outer.difference(inner).intersection(Polygon([(-1, -14), (14, -14), (14, 14), (-1, 14)]))
    bow = affinity.translate(bow, -3, 12.5)
    string = Polygon([(-0.4, 0.3), (0.4, 0.3), (0.4, 24.7), (-0.4, 24.7)])
    arrow = Polygon([(-1, 12.1), (11, 12.1), (11, 11.2), (14, 12.5), (11, 13.8), (11, 12.9), (-1, 12.9)])
    return [body(h), extrude(bow.union(string).union(arrow), 2.4, h - 0.5)]


def divyadrishti():
    h = 30
    eye = Polygon([(-11, 9), (-6, 13.5), (0, 15), (6, 13.5), (11, 9), (6, 4.5), (0, 3), (-6, 4.5)])
    iris = Point(0, 9).buffer(3.6, 48)
    slab = extrude(eye.difference(iris.buffer(-0.01)), 2.6, h - 0.5)
    pupil = sphere(3.2, [0, 0, h + 8.5])
    halo = trimesh.creation.torus(major_radius=13, minor_radius=0.7, major_sections=72, minor_sections=12)
    halo.apply_transform(trimesh.transformations.rotation_matrix(math.radians(70), [1, 0, 0]))
    halo.apply_translation([0, 0, h + 8.5])
    return [body(h), slab, pupil, halo]


def yantrik():
    h = 26
    teeth = 10
    pts = []
    for i in range(teeth * 2):
        a = math.pi * i / teeth
        r = 10.5 if i % 2 == 0 else 8.2
        pts.append((math.cos(a - 0.12) * r, math.sin(a - 0.12) * r + 10.5))
        pts.append((math.cos(a + 0.12) * r, math.sin(a + 0.12) * r + 10.5))
    gear = Polygon(pts).difference(Point(0, 10.5).buffer(3.6, 32))
    return [body(h), extrude(gear, 3.2, h - 1)]


def rath():
    h = 20
    return [body(h), wheel(8.0, h - 1.5, spokes=6, tube=1.1)]


def chara():
    h = 24
    blade = Polygon([(-2.6, 0), (2.6, 0), (2.2, 14), (0, 22), (-2.2, 14)])
    guard = Polygon([(-6, -1.4), (6, -1.4), (6, 1), (-6, 1)])
    grip = Polygon([(-4.2, -6.5), (-3, -6.5), (-3, -1.4), (-4.2, -1.4)]).union(
        Polygon([(3, -6.5), (4.2, -6.5), (4.2, -1.4), (3, -1.4)])).union(
        Polygon([(-4.2, -6.5), (4.2, -6.5), (4.2, -5.3), (-4.2, -5.3)]))
    katar = affinity.translate(blade.union(guard).union(grip), 0, 6.5)
    return [body(h), extrude(katar, 2.0, h - 0.5)]


def shataghni():
    parts = [lathe([(0, 0), (BASE_R, 0), (BASE_R, 2.4), (BASE_R - 1.4, 3.4), (8, 5), (5, 9), (0, 9)])]
    c = [0, 0, 18]
    parts.append(sphere(8.5, c))
    dirs = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1),
            (1, 1, 1), (-1, 1, 1), (1, -1, 1), (-1, -1, 1), (1, 1, -0.4), (-1, 1, -0.4), (1, -1, -0.4), (-1, -1, -0.4)]
    for d in dirs:
        v = np.array(d, dtype=float)
        v /= np.linalg.norm(v)
        parts.append(cone(2.0, 5.5, list(np.array(c) + v * 10.5), v))
    return parts


def durg():
    parts = [lathe([(0, 0), (BASE_R, 0), (BASE_R, 2.4), (BASE_R - 1.4, 3.4), (11, 4.5), (0, 4.5)])]
    tower = trimesh.creation.box(extents=[20, 20, 24])
    tower.apply_translation([0, 0, 4.5 + 12])
    parts.append(tower)
    for x in (-8, -2.7, 2.7, 8):
        for y in (-8.5, 8.5):
            m = trimesh.creation.box(extents=[3.4, 3, 4])
            m.apply_translation([x, y, 4.5 + 24 + 2])
            parts.append(m)
            m2 = trimesh.creation.box(extents=[3, 3.4, 4])
            m2.apply_translation([y, x, 4.5 + 24 + 2])
            parts.append(m2)
    door = trimesh.creation.box(extents=[7, 2, 10])
    door.apply_translation([0, -10.4, 4.5 + 5])
    arch = trimesh.creation.cylinder(radius=3.5, height=2, sections=32)
    arch.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    arch.apply_translation([0, -10.4, 4.5 + 10])
    parts += [door, arch, sphere(2.2, [0, 0, 4.5 + 24 + 6])]
    return parts


def tile():
    """The playable piece for a real table: an upright stone that hides its face
    from the opponent, like the screen of a hidden-rank game. Stick the piece art
    in the recess on the owner's side."""
    base = lathe([(0, 0), (BASE_R, 0), (BASE_R, 2.4), (BASE_R - 1.4, 3.4), (11, 4.2), (0, 4.2)])
    slab = trimesh.creation.box(extents=[24, 9, 30])
    slab.apply_translation([0, 0, 4.2 + 15])
    cap = trimesh.creation.cylinder(radius=12, height=9, sections=48)
    cap.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    cap.apply_translation([0, 0, 4.2 + 30])
    stone = [base, slab, cap]
    try:
        body_ = trimesh.boolean.union(stone, engine='manifold')
        recess = trimesh.creation.box(extents=[19, 2, 26])
        recess.apply_translation([0, -4.5, 4.2 + 17])
        return [trimesh.boolean.difference([body_, recess], engine='manifold')]
    except Exception:
        return stone


PIECES = [
    ('senapati', senapati), ('maharathi', maharathi), ('ashvarohi', ashvarohi), ('dhanurdhar', dhanurdhar),
    ('divyadrishti', divyadrishti), ('yantrik', yantrik), ('rath', rath), ('chara', chara),
    ('shataghni', shataghni), ('durg', durg), ('tile', tile),
]

FINISH = {
    'surya': dict(baseColorFactor=[0.83, 0.6, 0.24, 1.0], metallicFactor=0.92, roughnessFactor=0.32),
    'chandra': dict(baseColorFactor=[0.62, 0.64, 0.86, 1.0], metallicFactor=0.85, roughnessFactor=0.38),
}


def build(fn):
    parts = fn()
    try:
        # one watertight solid, so slicers and Blender see a single clean body
        mesh = trimesh.boolean.union(parts, engine='manifold')
    except Exception:  # no boolean engine: overlapping shells still print fine
        mesh = trimesh.util.concatenate(parts)
    mesh.merge_vertices()
    return mesh


def main():
    os.makedirs(os.path.join(OUT, 'glb'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'stl'), exist_ok=True)
    meshes = {}
    for slug, fn in PIECES:
        mesh = build(fn)
        meshes[slug] = mesh
        mesh.export(os.path.join(OUT, 'stl', slug + '.stl'))
        for finish, pbr in FINISH.items():
            m = mesh.copy()
            m.apply_scale(0.001)                       # glTF is in metres
            m.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name=finish, **pbr))
            m.export(os.path.join(OUT, 'glb', slug + '_' + finish + '.glb'))
        h = mesh.bounds[1][2]
        print(f'{slug:13s} {len(mesh.faces):6d} triangles  {h:5.1f} mm tall  watertight={mesh.is_watertight}')
    preview(meshes)


def preview(meshes):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    fig = plt.figure(figsize=(18, 6.4), facecolor='#0b0810')
    light = np.array([0.4, -0.6, 0.7])
    light /= np.linalg.norm(light)
    for i, (slug, mesh) in enumerate(meshes.items()):
        ax = fig.add_subplot(2, 6, i + 1, projection='3d')
        ax.set_facecolor('#0b0810')
        tris = mesh.vertices[mesh.faces]
        shade = np.clip(np.abs(mesh.face_normals @ light), 0.18, 1.0)
        base = np.array([0.88, 0.66, 0.29])
        colors = np.clip(base[None, :] * (0.35 + 0.75 * shade[:, None]), 0, 1)
        coll = Poly3DCollection(tris, facecolors=colors, edgecolors='none', linewidths=0)
        ax.add_collection3d(coll)
        ax.set_xlim(-16, 16); ax.set_ylim(-16, 16); ax.set_zlim(0, 54)
        ax.set_box_aspect((1, 1, 1.7))
        ax.view_init(elev=14, azim=-62)
        ax.set_axis_off()
        ax.set_title(slug.capitalize(), color='#f2cf8b', fontsize=11, pad=-2)
    plt.subplots_adjust(left=0, right=1, top=0.95, bottom=0, wspace=0, hspace=0.05)
    fig.savefig(os.path.join(OUT, 'preview.png'), dpi=110, facecolor='#0b0810')
    print('preview written')


if __name__ == '__main__':
    main()
