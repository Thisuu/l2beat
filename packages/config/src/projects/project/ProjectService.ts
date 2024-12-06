import { ProjectId } from '@l2beat/shared-pure'
import { Project } from './Project'
import { getProjects } from './getProjects'

type Key = Exclude<keyof Project, 'id' | 'slug'>
type NonOptionalProject = {
  [K in Key]-?: Project[K]
}
type ProjectWith<K extends Key, O extends Key> = Pick<NonOptionalProject, K> &
  Pick<Project, O | 'id' | 'slug'>

export class ProjectService {
  constructor(private _getProjects = getProjects) {}

  private projects: Promise<Project[]> | undefined

  async getProject<K extends Key = never, O extends Key = never>(query: {
    id?: ProjectId
    slug?: string
    select?: K[]
    optional?: O[]
    where?: Key[]
    whereNot?: Key[]
  }): Promise<ProjectWith<K, O> | undefined> {
    const projects = await this.getAllProjects()
    const project = projects.find(
      createFilter({
        ids: query.id ? [query.id] : undefined,
        slugs: query.slug ? [query.slug] : undefined,
        ...query,
      }),
    )
    if (project) {
      return createMap(query)(project)
    }
  }

  async getProjects<K extends Key = never, O extends Key = never>(query: {
    ids?: ProjectId[]
    slugs?: string[]
    select?: K[]
    optional?: O[]
    where?: Key[]
    whereNot?: Key[]
  }): Promise<ProjectWith<K, O>[]> {
    const projects = await this.getAllProjects()
    return projects.filter(createFilter(query)).map(createMap(query))
  }

  private async getAllProjects() {
    if (!this.projects) {
      this.projects = this._getProjects()
    }
    return await this.projects
  }
}

function createFilter(query: {
  ids?: ProjectId[]
  slugs?: string[]
  select?: Key[]
  where?: Key[]
  whereNot?: Key[]
}) {
  return function filter(project: Project): boolean {
    return (
      (!query.ids || query.ids.includes(project.id)) &&
      (!query.slugs || query.slugs.includes(project.slug)) &&
      (!query.select || query.select.every((key) => !!project[key])) &&
      (!query.where || query.where.every((key) => !!project[key])) &&
      (!query.whereNot || query.whereNot.every((key) => !project[key]))
    )
  }
}

function createMap<K extends Key, O extends Key>(query: {
  select?: K[]
  optional?: O[]
}) {
  const keys = [
    'id',
    'slug',
    ...(query.select ?? []),
    ...(query.optional ?? []),
  ] as (keyof ProjectWith<K, O>)[]
  return function map(project: Project) {
    const result = {} as ProjectWith<K, O>
    for (const key of keys) {
      // biome-ignore lint/suspicious/noExplicitAny: This is actually correct
      result[key] = project[key] as any
    }
    return result
  }
}
