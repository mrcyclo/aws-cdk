export const getServiceName = (name: String) => {
    return (process.env.SERVICE_NAME_PREPEND || '') + name;
}
